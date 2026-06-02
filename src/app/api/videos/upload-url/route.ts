import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import {
  createVideoSignedUploadRequestSchema,
  getAllowedVideoFileTypesLabel,
  getFileExtension,
  getMaxSourceVideoUploadBytes,
  getMaxSourceVideoUploadLabel,
  isAllowedVideoFileMetadata,
  validationErrorResponse,
} from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { getStorageService } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = createVideoSignedUploadRequestSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const { fileName, fileSize, contentType } = parsed.data;

  if (!isAllowedVideoFileMetadata(fileName, contentType)) {
    return NextResponse.json(
      { error: `Unsupported video file type. Allowed types: ${getAllowedVideoFileTypesLabel()}.` },
      { status: 400 },
    );
  }

  if (fileSize > getMaxSourceVideoUploadBytes()) {
    return NextResponse.json(
      {
        error: `Source video is too large. Maximum upload size is ${getMaxSourceVideoUploadLabel()}. Compress the video, trim it, or raise MAX_SOURCE_VIDEO_UPLOAD_MB if your storage plan supports larger files.`,
      },
      { status: 400 },
    );
  }

  const videoId = randomUUID();
  const extension = getFileExtension(fileName);
  const sourceStoragePath = `users/${user.id}/videos/${videoId}/source.${extension}`;
  const title = parsed.data.title?.trim() || fileName;

  const video = await prisma.video.create({
    data: {
      id: videoId,
      userId: user.id,
      sourceType: "file",
      title,
      sourceStoragePath,
      status: "pending",
    },
  });

  try {
    const signedUpload = await getStorageService().createSignedUploadUrl(sourceStoragePath, {
      upsert: false,
    });

    await prisma.log.create({
      data: {
        userId: user.id,
        level: "info",
        message: "Source video signed upload URL created.",
        metadata: {
          phase: 3,
          videoId: video.id,
          sourceStoragePath,
          fileName,
          contentType,
          size: fileSize,
        },
      },
    });

    return NextResponse.json(
      {
        videoId: video.id,
        sourceStoragePath,
        signedUploadUrl: signedUpload.signedUrl,
        expiresInSeconds: signedUpload.expiresInSeconds,
      },
      { status: 201 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unable to create signed upload URL.";

    await prisma.video.update({
      where: {
        id: video.id,
      },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    return NextResponse.json(
      {
        error: "Video task was created but a signed upload URL could not be created. Check storage configuration.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        videoId: video.id,
        status: "failed",
      },
      { status: 503 },
    );
  }
}
