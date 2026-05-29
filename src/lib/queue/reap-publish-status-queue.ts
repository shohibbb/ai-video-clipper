import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { createQueueRedisConnection } from "@/lib/queue/redis";

export const REAP_PUBLISH_STATUS_QUEUE_NAME = "reap-publish-status";
export const REAP_PUBLISH_STATUS_JOB_NAME = "poll-reap-post";
export const REAP_PUBLISH_STATUS_MAX_ATTEMPTS = 120;
export const REAP_PUBLISH_STATUS_INTERVAL_MS = 30_000;
export const DEFAULT_REAP_PUBLISH_STATUS_CONCURRENCY = 1;

export type ReapPublishStatusJobData = {
  dbJobId: string;
  userId: string;
  clipId: string;
  uploadTargetId: string;
  reapPostId: string;
};

type ReapPublishStatusJobInput = {
  userId: string;
  clipId: string;
  uploadTargetId: string;
  reapPostId: string;
};

const reapPublishStatusJobOptions = {
  attempts: REAP_PUBLISH_STATUS_MAX_ATTEMPTS,
  backoff: {
    type: "fixed" as const,
    delay: REAP_PUBLISH_STATUS_INTERVAL_MS,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 1000,
  },
} satisfies JobsOptions;

let reapPublishStatusQueue: Queue<ReapPublishStatusJobData> | null = null;

export function getReapPublishStatusQueue() {
  reapPublishStatusQueue ??= new Queue<ReapPublishStatusJobData>(REAP_PUBLISH_STATUS_QUEUE_NAME, {
    connection: createQueueRedisConnection("ai-video-clipper-reap-publish-status-queue"),
    defaultJobOptions: reapPublishStatusJobOptions,
  });

  return reapPublishStatusQueue;
}

export async function enqueueReapPublishStatusJob({
  userId,
  clipId,
  uploadTargetId,
  reapPostId,
}: ReapPublishStatusJobInput) {
  const dbJob = await prisma.job.create({
    data: {
      userId,
      clipId,
      jobType: "reap_publish_status",
      status: "queued",
      maxAttempts: REAP_PUBLISH_STATUS_MAX_ATTEMPTS,
    },
  });

  await logEvent({
    userId,
    jobId: dbJob.id,
    level: "info",
    event: "reap.publish_status.job.created",
    component: "reap-publish-status-queue",
    message: "Reap publish status polling job record created.",
    metadata: { clipId, uploadTargetId, reapPostId },
  });

  try {
    const queueJob = await getReapPublishStatusQueue().add(
      REAP_PUBLISH_STATUS_JOB_NAME,
      {
        dbJobId: dbJob.id,
        userId,
        clipId,
        uploadTargetId,
        reapPostId,
      },
      {
        ...reapPublishStatusJobOptions,
        jobId: dbJob.id,
      },
    );

    await logEvent({
      userId,
      jobId: dbJob.id,
      level: "info",
      event: "reap.publish_status.job.enqueued",
      component: "reap-publish-status-queue",
      message: "Reap publish status polling job enqueued in BullMQ.",
      metadata: {
        queueName: REAP_PUBLISH_STATUS_QUEUE_NAME,
        queueJobId: queueJob.id,
        clipId,
        uploadTargetId,
        reapPostId,
        pollIntervalMs: REAP_PUBLISH_STATUS_INTERVAL_MS,
        maxAttempts: REAP_PUBLISH_STATUS_MAX_ATTEMPTS,
      },
    });

    return dbJob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to enqueue Reap publish status polling job.";

    await prisma.job.update({
      where: { id: dbJob.id },
      data: {
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      },
    });

    await logEvent({
      userId,
      jobId: dbJob.id,
      level: "error",
      event: "reap.publish_status.job.enqueue_failed",
      component: "reap-publish-status-queue",
      message: "Failed to enqueue Reap publish status polling job in BullMQ.",
      metadata: {
        queueName: REAP_PUBLISH_STATUS_QUEUE_NAME,
        uploadTargetId,
        reapPostId,
        errorMessage,
        error: serializeError(error),
      },
    });

    throw error;
  }
}
