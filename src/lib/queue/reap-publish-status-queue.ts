import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { createQueueRedisConnection } from "@/lib/queue/redis";

export const REAP_PUBLISH_STATUS_QUEUE_NAME = "reap-publish-status";
export const REAP_PUBLISH_STATUS_JOB_NAME = "poll-reap-post";
export const DEFAULT_REAP_PUBLISH_STATUS_CONCURRENCY = 1;

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getReapPublishStatusConfig() {
  const intervalMs = getPositiveIntegerEnv("REAP_PUBLISH_STATUS_INTERVAL_MS", 120_000);
  const timeoutMs = getPositiveIntegerEnv("REAP_PUBLISH_STATUS_TIMEOUT_MS", 7_200_000);

  return {
    intervalMs,
    timeoutMs,
    maxAttempts: Math.max(1, Math.ceil(timeoutMs / intervalMs)),
  };
}

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

function getReapPublishStatusJobOptions() {
  const config = getReapPublishStatusConfig();

  return {
    attempts: config.maxAttempts,
    backoff: {
      type: "fixed" as const,
      delay: config.intervalMs,
    },
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 1000,
    },
  } satisfies JobsOptions;
}

let reapPublishStatusQueue: Queue<ReapPublishStatusJobData> | null = null;

export function getReapPublishStatusQueue() {
  reapPublishStatusQueue ??= new Queue<ReapPublishStatusJobData>(REAP_PUBLISH_STATUS_QUEUE_NAME, {
    connection: createQueueRedisConnection("ai-video-clipper-reap-publish-status-queue"),
    defaultJobOptions: getReapPublishStatusJobOptions(),
  });

  return reapPublishStatusQueue;
}

export async function enqueueReapPublishStatusJob({
  userId,
  clipId,
  uploadTargetId,
  reapPostId,
}: ReapPublishStatusJobInput) {
  const config = getReapPublishStatusConfig();
  const dbJob = await prisma.job.create({
    data: {
      userId,
      clipId,
      jobType: "reap_publish_status",
      status: "queued",
      maxAttempts: config.maxAttempts,
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
        ...getReapPublishStatusJobOptions(),
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
        pollIntervalMs: config.intervalMs,
        maxAttempts: config.maxAttempts,
        timeoutMs: config.timeoutMs,
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
