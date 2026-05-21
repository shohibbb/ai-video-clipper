import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { createQueueRedisConnection } from "@/lib/queue/redis";

export const CLIP_UPLOAD_QUEUE_NAME = "clip-upload";
export const CLIP_UPLOAD_JOB_NAME = "upload-clip-to-tiktok";
export const TIKTOK_UPLOAD_MAX_ATTEMPTS = 3;
export const TIKTOK_UPLOAD_RETRY_DELAY_MS = 5 * 60 * 1000;
export const DEFAULT_UPLOAD_WORKER_CONCURRENCY = 1;

export type ClipUploadJobData = {
  dbJobId: string;
  userId: string;
  clipId: string;
  uploadTargetId: string;
  platform: "tiktok";
};

type UploadJobInput = {
  userId: string;
  clipId: string;
  uploadTargetId: string;
};

const clipUploadJobOptions = {
  attempts: TIKTOK_UPLOAD_MAX_ATTEMPTS,
  backoff: {
    type: "fixed",
    delay: TIKTOK_UPLOAD_RETRY_DELAY_MS,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 1000,
  },
} satisfies JobsOptions;

let clipUploadQueue: Queue<ClipUploadJobData> | null = null;

export function getClipUploadQueue() {
  clipUploadQueue ??= new Queue<ClipUploadJobData>(CLIP_UPLOAD_QUEUE_NAME, {
    connection: createQueueRedisConnection("ai-video-clipper-upload-queue"),
    defaultJobOptions: clipUploadJobOptions,
  });

  return clipUploadQueue;
}

export async function enqueueClipUploadJob({ userId, clipId, uploadTargetId }: UploadJobInput) {
  const dbJob = await prisma.job.create({
    data: {
      userId,
      clipId,
      jobType: "reap_publish",
      status: "queued",
      maxAttempts: TIKTOK_UPLOAD_MAX_ATTEMPTS,
    },
  });

  await logEvent({
    userId,
    jobId: dbJob.id,
    level: "info",
    event: "upload.job.created",
    component: "upload-queue",
    message: "TikTok upload job record created.",
    metadata: {
      phase: 6,
      clipId,
      uploadTargetId,
      platform: "tiktok",
    },
  });

  try {
    const queueJob = await getClipUploadQueue().add(
      CLIP_UPLOAD_JOB_NAME,
      {
        dbJobId: dbJob.id,
        userId,
        clipId,
        uploadTargetId,
        platform: "tiktok",
      },
      {
        ...clipUploadJobOptions,
        jobId: dbJob.id,
      },
    );

    await logEvent({
      userId,
      jobId: dbJob.id,
      level: "info",
      event: "upload.job.enqueued",
      component: "upload-queue",
      message: "TikTok upload job enqueued in BullMQ.",
      metadata: {
        phase: 6,
        queueName: CLIP_UPLOAD_QUEUE_NAME,
        queueJobId: queueJob.id,
        attempts: TIKTOK_UPLOAD_MAX_ATTEMPTS,
        retryDelayMs: TIKTOK_UPLOAD_RETRY_DELAY_MS,
      },
    });

    return dbJob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to enqueue TikTok upload job.";

    await prisma.job.update({
      where: {
        id: dbJob.id,
      },
      data: {
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      },
    });

    await prisma.uploadTarget.update({
      where: {
        id: uploadTargetId,
      },
      data: {
        uploadStatus: "failed",
        errorMessage: "Failed to enqueue TikTok upload job. Check REDIS_URL and Redis availability.",
      },
    });

    await logEvent({
      userId,
      jobId: dbJob.id,
      level: "error",
      event: "upload.job.enqueue_failed",
      component: "upload-queue",
      message: "Failed to enqueue TikTok upload job in BullMQ.",
      metadata: {
        phase: 6,
        queueName: CLIP_UPLOAD_QUEUE_NAME,
        uploadTargetId,
        errorMessage,
        error: serializeError(error),
      },
    });

    throw error;
  }
}
