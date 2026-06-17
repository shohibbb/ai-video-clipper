import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import {
  uploadClipRequestSchema,
  validationErrorResponse,
} from "@/lib/api/validation";
import { enqueueClipUploadJob } from "@/lib/queue/upload-queue";
import { prisma } from "@/lib/prisma";
import { getClipForUser } from "@/lib/user-owned-records";
import { uploadToInstagramReels } from "@/lib/composio";
import { getSocialAccountById } from "@/lib/composio/accounts";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Build a public URL for a clip stored in Supabase Storage.
 * The `clips` bucket is public, so no signed URL is needed.
 * Instagram requires a direct URL without query parameters.
 */
function buildClipPublicUrl(storagePath: string): string {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  return `${supabaseUrl}/storage/v1/object/public/clips/${storagePath}`;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) ?? {};
  const parsed = uploadClipRequestSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const platform = parsed.data.platform;

  const clip = await getClipForUser(user.id, id);

  if (!clip) {
    return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  }

  if (!clip.storagePath) {
    return NextResponse.json(
      {
        error: `Clip must have a storage path before it can be uploaded to ${platform === "tiktok" ? "TikTok" : "Instagram"}.`,
      },
      { status: 400 },
    );
  }

  // TikTok requires Reap clip ID for publishing via Reap
  if (platform === "tiktok" && !clip.reapClipId) {
    return NextResponse.json(
      {
        error:
          "Clip must have a Reap clip ID before it can be published to TikTok.",
      },
      { status: 400 },
    );
  }

  const activeUpload = await prisma.uploadTarget.findFirst({
    where: {
      clipId: clip.id,
      userId: user.id,
      platform,
      uploadStatus: {
        in: ["queued", "uploading", "publishing"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (activeUpload) {
    return NextResponse.json(
      {
        error: `This clip already has a ${platform === "tiktok" ? "TikTok" : "Instagram"} upload queued or in progress.`,
        uploadTargetId: activeUpload.id,
        status: activeUpload.uploadStatus,
      },
      { status: 409 },
    );
  }

  let uploadTarget;
  try {
    uploadTarget = await prisma.uploadTarget.create({
      data: {
        clipId: clip.id,
        userId: user.id,
        platform,
        uploadStatus: "queued",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error: `This clip already has a ${platform === "tiktok" ? "TikTok" : "Instagram"} upload queued or in progress.`,
        },
        { status: 409 },
      );
    }

    throw error;
  }

  // --- Instagram: Direct upload via Composio ---
  if (platform === "instagram") {
    try {
      const connectedAccountId = parsed.data.connectedAccountId ?? undefined;

      if (!connectedAccountId) {
        return NextResponse.json(
          { error: "Please select an Instagram account before uploading." },
          { status: 400 },
        );
      }

      const socialAccount = await getSocialAccountById(
        connectedAccountId,
        user.id,
      );

      if (!socialAccount) {
        return NextResponse.json(
          {
            error:
              "Instagram account not found. Connect your Instagram account first.",
          },
          { status: 400 },
        );
      }

      await prisma.uploadTarget.update({
        where: { id: uploadTarget.id },
        data: { uploadStatus: "uploading" },
      });

      await prisma.clip.update({
        where: { id: clip.id },
        data: { status: "uploading" },
      });

      const entityId = socialAccount.connectedId;
      const igUserId = socialAccount.igUserId;

      if (!igUserId) {
        throw new Error("Instagram user ID not found for this account.");
      }

      const publicVideoUrl = buildClipPublicUrl(clip.storagePath);

      // Build caption from clip metadata
      const clipCaptionParts: string[] = [];
      if (clip.caption) clipCaptionParts.push(clip.caption);
      if (clip.hashtags?.length) {
        clipCaptionParts.push(
          clip.hashtags
            .map((t: string) => (t.startsWith("#") ? t : `#${t}`))
            .join(" "),
        );
      }
      const caption = clipCaptionParts.join("\n\n");

      const result = await uploadToInstagramReels({
        entityId,
        igUserId,
        videoUrl: publicVideoUrl,
        caption,
        shareToFeed: true,
      });

      if (!result.success) {
        throw new Error(result.error ?? "Instagram upload failed.");
      }

      // Update records on success
      await prisma.uploadTarget.update({
        where: { id: uploadTarget.id },
        data: {
          uploadStatus: "completed",
          uploadedUrl: `https://instagram.com/reel/${result.mediaId}`,
          platformResponse: result,
          errorMessage: null,
        },
      });

      await prisma.clip.update({
        where: { id: clip.id },
        data: { status: "uploaded" },
      });

      return NextResponse.json(
        {
          uploadTargetId: uploadTarget.id,
          status: "completed",
          mediaId: result.mediaId,
          containerId: result.containerId,
        },
        { status: 201 },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Instagram upload failed.";

      await prisma.uploadTarget
        .update({
          where: { id: uploadTarget.id },
          data: {
            uploadStatus: "failed",
            errorMessage,
          },
        })
        .catch(() => {});

      await prisma.clip
        .update({
          where: { id: clip.id },
          data: { status: "ready_to_upload" },
        })
        .catch(() => {});

      return NextResponse.json({ error: errorMessage }, { status: 503 });
    }
  }

  // --- TikTok: Queue via BullMQ / Reap ---
  try {
    await prisma.clip.update({
      where: {
        id: clip.id,
      },
      data: {
        status: "uploading",
      },
    });

    const job = await enqueueClipUploadJob({
      userId: user.id,
      clipId: clip.id,
      uploadTargetId: uploadTarget.id,
    });

    return NextResponse.json(
      {
        uploadTargetId: uploadTarget.id,
        jobId: job.id,
        status: uploadTarget.uploadStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    await prisma.clip.update({
      where: {
        id: clip.id,
      },
      data: {
        status: "ready_to_upload",
      },
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to enqueue TikTok upload.",
      },
      { status: 503 },
    );
  }
}
