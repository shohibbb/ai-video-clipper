import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { enqueueClipUploadJob } from "@/lib/queue/upload-queue";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const platform = String(body?.platform ?? "tiktok").trim().toLowerCase();

  if (platform !== "tiktok") {
    return NextResponse.json({ error: "MVP upload target is TikTok only." }, { status: 400 });
  }

  const clip = await prisma.clip.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  }

  if (!clip.storagePath) {
    return NextResponse.json({ error: "Clip must have a storage path before it can be uploaded to TikTok." }, { status: 400 });
  }

  const activeUpload = await prisma.uploadTarget.findFirst({
    where: {
      clipId: clip.id,
      userId: user.id,
      platform,
      uploadStatus: {
        in: ["queued", "uploading"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (activeUpload) {
    return NextResponse.json(
      {
        error: "This clip already has a TikTok upload queued or in progress.",
        uploadTargetId: activeUpload.id,
        status: activeUpload.uploadStatus,
      },
      { status: 409 },
    );
  }

  const uploadTarget = await prisma.uploadTarget.create({
    data: {
      clipId: clip.id,
      userId: user.id,
      platform,
      uploadStatus: "queued",
    },
  });

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
        error: error instanceof Error ? error.message : "Unable to enqueue TikTok upload.",
      },
      { status: 503 },
    );
  }
}
