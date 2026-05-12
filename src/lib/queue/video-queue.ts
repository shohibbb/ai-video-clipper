import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { createQueueRedisConnection } from "@/lib/queue/redis";

export const VIDEO_PROCESSING_QUEUE_NAME = "video-processing";
export const VIDEO_PROCESSING_JOB_NAME = "process-video";
export const OPUSCLIP_MAX_ATTEMPTS = 3;
export const OPUSCLIP_RETRY_DELAY_MS = 5 * 60 * 1000;
export const DEFAULT_OPUSCLIP_WORKER_CONCURRENCY = 1;

export type VideoProcessingJobData = {
  dbJobId: string;
  userId: string;
  videoId: string;
  sourceUrl?: string | null;
  sourceStoragePath?: string | null;
};

type VideoJobInput = {
  userId: string;
  videoId: string;
  sourceUrl?: string | null;
  sourceStoragePath?: string | null;
};

const videoProcessingJobOptions = {
  attempts: OPUSCLIP_MAX_ATTEMPTS,
  backoff: {
    type: "fixed",
    delay: OPUSCLIP_RETRY_DELAY_MS,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 1000,
  },
} satisfies JobsOptions;

let videoProcessingQueue: Queue<VideoProcessingJobData> | null = null;

export function getVideoProcessingQueue() {
  videoProcessingQueue ??= new Queue<VideoProcessingJobData>(VIDEO_PROCESSING_QUEUE_NAME, {
    connection: createQueueRedisConnection(),
    defaultJobOptions: videoProcessingJobOptions,
  });

  return videoProcessingQueue;
}

export async function enqueueVideoProcessingJob({
  userId,
  videoId,
  sourceUrl,
  sourceStoragePath,
}: VideoJobInput) {
  const dbJob = await prisma.job.create({
    data: {
      userId,
      videoId,
      jobType: "opusclip_process",
      status: "queued",
      maxAttempts: OPUSCLIP_MAX_ATTEMPTS,
    },
  });

  await prisma.log.create({
    data: {
      userId,
      jobId: dbJob.id,
      level: "info",
      message: "Video processing job record created.",
      metadata: {
        phase: 2,
        videoId,
      },
    },
  });

  try {
    const queueJob = await getVideoProcessingQueue().add(
      VIDEO_PROCESSING_JOB_NAME,
      {
        dbJobId: dbJob.id,
        userId,
        videoId,
        sourceUrl,
        sourceStoragePath,
      },
      {
        ...videoProcessingJobOptions,
        jobId: dbJob.id,
      },
    );

    await prisma.log.create({
      data: {
        userId,
        jobId: dbJob.id,
        level: "info",
        message: "Video processing job enqueued in BullMQ.",
        metadata: {
          phase: 2,
          queueName: VIDEO_PROCESSING_QUEUE_NAME,
          queueJobId: queueJob.id,
          attempts: OPUSCLIP_MAX_ATTEMPTS,
          retryDelayMs: OPUSCLIP_RETRY_DELAY_MS,
        },
      },
    });

    return dbJob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to enqueue video processing job.";

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

    await prisma.video.update({
      where: {
        id: videoId,
      },
      data: {
        status: "failed",
        errorMessage: "Failed to enqueue video processing job. Check REDIS_URL and Redis availability.",
      },
    });

    await prisma.log.create({
      data: {
        userId,
        jobId: dbJob.id,
        level: "error",
        message: "Failed to enqueue video processing job in BullMQ.",
        metadata: {
          phase: 2,
          queueName: VIDEO_PROCESSING_QUEUE_NAME,
          errorMessage,
        },
      },
    });

    throw error;
  }
}
