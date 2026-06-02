import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import {
  completeVideoFileUploadRequestSchema,
  getAllowedVideoFileTypesLabel,
  getMaxSourceVideoUploadBytes,
  getMaxSourceVideoUploadLabel,
  isAllowedVideoFileMetadata,
  validationErrorResponse,
} from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { enqueueVideoOrFail } from "@/lib/services/video-task-queue";
import { getStorageService } from "@/lib/storage";
import { getVideoForUser } from "@/lib/user-owned-records";

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

  if (!body) {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const parsed = completeVideoFileUploadRequestSchema.safeParse(body);

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

  const video = await getVideoForUser(user.id, id);

  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  if (video.sourceType !== "file" || !video.sourceStoragePath) {
    return NextResponse.json({ error: "Video is not waiting for a source file upload." }, { status: 400 });
  }

  if (video.status !== "pending" && video.status !== "failed") {
    return NextResponse.json({ error: `Video upload cannot be completed while status is "${video.status}".` }, { status: 409 });
  }

  const sourceExists = await getStorageService().fileExists(video.sourceStoragePath);

  if (!sourceExists) {
    return NextResponse.json(
      { error: "Source file upload has not completed yet. Try again after the browser upload finishes." },
      { status: 400 },
    );
  }

  const updatedVideo = await prisma.video.update({
    where: {
      id: video.id,
    },
    data: {
      status: "queued",
      errorMessage: null,
    },
  });

  await prisma.log.create({
    data: {
      userId: user.id,
      level: "info",
      message: "Source video uploaded to storage.",
      metadata: {
        phase: 3,
        videoId: updatedVideo.id,
        sourceStoragePath: updatedVideo.sourceStoragePath,
        fileName,
        contentType,
        size: fileSize,
      },
    },
  });

  const job = await enqueueVideoOrFail(updatedVideo);

  if (!job) {
    await prisma.video.update({
      where: {
        id: updatedVideo.id,
      },
      data: {
        status: "failed",
        errorMessage: "Failed to enqueue video processing job. Check REDIS_URL and Redis availability.",
      },
    });

    return NextResponse.json(
      {
        error: "Video source was uploaded but could not be enqueued. Check REDIS_URL and Redis availability.",
        videoId: updatedVideo.id,
        status: "failed",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      videoId: updatedVideo.id,
      status: updatedVideo.status,
      sourceStoragePath: updatedVideo.sourceStoragePath,
      jobId: job.id,
    },
    { status: 201 },
  );
}
