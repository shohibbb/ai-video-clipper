import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireCurrentUser();
  const { id } = await params;

  const video = await prisma.video.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      clips: {
        include: {
          uploadTargets: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      jobs: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: video.id,
    sourceType: video.sourceType,
    sourceUrl: video.sourceUrl,
    sourceStoragePath: video.sourceStoragePath,
    title: video.title,
    durationSeconds: video.durationSeconds,
    status: video.status,
    errorMessage: video.errorMessage,
    retryCount: video.retryCount,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
    clips: video.clips.map((clip) => ({
      id: clip.id,
      storagePath: clip.storagePath,
      previewUrl: clip.previewUrl,
      durationSeconds: clip.durationSeconds,
      title: clip.title,
      caption: clip.caption,
      hashtags: clip.hashtags,
      status: clip.status,
      uploadTargets: clip.uploadTargets.map((target) => ({
        id: target.id,
        platform: target.platform,
        uploadStatus: target.uploadStatus,
        uploadedUrl: target.uploadedUrl,
        platformResponse: target.platformResponse,
        errorMessage: target.errorMessage,
      })),
    })),
    jobs: video.jobs.map((job) => ({
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    })),
  });
}
