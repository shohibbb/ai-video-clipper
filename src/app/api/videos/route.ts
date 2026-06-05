import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireCurrentUser } from "@/lib/auth";
import {
  createVideoFileFieldsSchema,
  createVideoUrlRequestSchema,
  getAllowedVideoFileTypesLabel,
  getFileExtension,
  getMaxSourceVideoUploadBytes,
  getMaxSourceVideoUploadLabel,
  isAllowedVideoFile,
  validationErrorResponse,
} from "@/lib/api/validation";
import { prisma } from "@/lib/prisma";
import { enqueueVideoOrFail } from "@/lib/services/video-task-queue";
import { getStorageService } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireCurrentUser();
  const videos = await prisma.video.findMany({
    where: {
      userId: user.id,
    },
    include: {
      clips: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    data: videos.map((video) => ({
      id: video.id,
      title: video.title,
      sourceType: video.sourceType,
      sourceUrl: video.sourceUrl,
      sourceStoragePath: video.sourceStoragePath,
      status: video.status,
      reapProjectId: video.reapProjectId,
      clipCount: video.clips.length,
      errorMessage: video.errorMessage,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    })),
  });
}

async function createUrlVideoTask(userId: string, body: unknown) {
  const parsed = createVideoUrlRequestSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const { sourceUrl, title } = parsed.data;
  const video = await prisma.video.create({
    data: {
      userId,
      sourceType: "url",
      sourceUrl,
      title: title?.trim() || null,
      status: "queued",
    },
  });

  const enqueueResult = await enqueueVideoOrFail(video);

  if (!enqueueResult.ok) {
    return NextResponse.json(
      {
        error: enqueueResult.errorMessage,
        videoId: video.id,
        status: "failed",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      videoId: video.id,
      status: video.status,
      jobId: enqueueResult.job.id,
    },
    { status: 201 },
  );
}

async function createFileVideoTask(userId: string, formData: FormData) {
  const fields = createVideoFileFieldsSchema.safeParse({
    sourceType: String(formData.get("sourceType") ?? "file"),
    title: String(formData.get("title") ?? "").trim() || null,
    platform: String(formData.get("platform") ?? "tiktok"),
  });

  if (!fields.success) {
    return validationErrorResponse(fields.error);
  }

  const sourceFile = formData.get("sourceFile");

  if (!(sourceFile instanceof File) || sourceFile.size === 0) {
    return NextResponse.json({ error: "A sourceFile upload is required." }, { status: 400 });
  }

  if (!isAllowedVideoFile(sourceFile)) {
    return NextResponse.json(
      { error: `Unsupported video file type. Allowed types: ${getAllowedVideoFileTypesLabel()}.` },
      { status: 400 },
    );
  }

  if (sourceFile.size > getMaxSourceVideoUploadBytes()) {
    return NextResponse.json(
      {
        error: `Source video is too large. Maximum upload size is ${getMaxSourceVideoUploadLabel()}. Compress the video, trim it, or raise MAX_SOURCE_VIDEO_UPLOAD_MB if your storage plan supports larger files.`,
      },
      { status: 400 },
    );
  }

  const videoId = randomUUID();
  const extension = getFileExtension(sourceFile.name);
  const sourceStoragePath = `users/${userId}/videos/${videoId}/source.${extension}`;
  const title = fields.data.title?.trim() || sourceFile.name;

  const video = await prisma.video.create({
    data: {
      id: videoId,
      userId,
      sourceType: "file",
      title,
      status: "pending",
    },
  });

  try {
    await getStorageService().uploadFile({
      path: sourceStoragePath,
      file: sourceFile,
      contentType: sourceFile.type || undefined,
      upsert: false,
    });

    await prisma.video.update({
      where: {
        id: video.id,
      },
      data: {
        sourceStoragePath,
        status: "queued",
      },
    });

    await prisma.log.create({
      data: {
        userId,
        level: "info",
        message: "Source video uploaded to storage.",
        metadata: {
          phase: 3,
          videoId: video.id,
          sourceStoragePath,
          fileName: sourceFile.name,
          contentType: sourceFile.type,
          size: sourceFile.size,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Source video upload failed.";

    await prisma.video.update({
      where: {
        id: video.id,
      },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    await prisma.log.create({
      data: {
        userId,
        level: "error",
        message: "Source video upload failed.",
        metadata: {
          phase: 3,
          videoId: video.id,
          errorMessage,
        },
      },
    });

    return NextResponse.json(
      {
        error: "Video task was created but the source file could not be uploaded. Check storage configuration.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        videoId: video.id,
        status: "failed",
      },
      { status: 503 },
    );
  }

  const updatedVideo = await prisma.video.findUniqueOrThrow({
    where: {
      id: video.id,
    },
  });

  const enqueueResult = await enqueueVideoOrFail(updatedVideo);

  if (!enqueueResult.ok) {
    return NextResponse.json(
      {
        error: enqueueResult.errorMessage,
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
      jobId: enqueueResult.job.id,
    },
    { status: 201 },
  );
}

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return createFileVideoTask(user.id, formData);
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  return createUrlVideoTask(user.id, body);
}
