import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { createQueueRedisConnection } from "@/lib/queue/redis";

export const REAP_POLLING_QUEUE_NAME = "reap-polling";
export const REAP_POLLING_JOB_NAME = "reap-poll-project";
export const REAP_POLLING_MAX_ATTEMPTS = 120;
export const REAP_POLLING_INTERVAL_MS = 30_000;
export const DEFAULT_REAP_POLLING_CONCURRENCY = 1;

export type ReapPollingJobData = {
  dbJobId: string;
  userId: string;
  videoId: string;
  reapProjectId: string;
};

type ReapPollingJobInput = {
  userId: string;
  videoId: string;
  reapProjectId: string;
};

const reapPollingJobOptions = {
  attempts: REAP_POLLING_MAX_ATTEMPTS,
  backoff: {
    type: "fixed" as const,
    delay: REAP_POLLING_INTERVAL_MS,
  },
  removeOnComplete: {
    count: 1000,
  },
  removeOnFail: {
    count: 1000,
  },
} satisfies JobsOptions;

let reapPollingQueue: Queue<ReapPollingJobData> | null = null;

export function getReapPollingQueue() {
  reapPollingQueue ??= new Queue<ReapPollingJobData>(REAP_POLLING_QUEUE_NAME, {
    connection: createQueueRedisConnection(),
    defaultJobOptions: reapPollingJobOptions,
  });

  return reapPollingQueue;
}

export async function enqueueReapPollingJob({
  userId,
  videoId,
  reapProjectId,
}: ReapPollingJobInput) {
  const dbJob = await prisma.job.create({
    data: {
      userId,
      videoId,
      jobType: "reap_process",
      status: "active",
      maxAttempts: REAP_POLLING_MAX_ATTEMPTS,
    },
  });

  await logEvent({
    userId,
    jobId: dbJob.id,
    level: "info",
    event: "reap.polling.job.created",
    component: "reap-polling-queue",
    message: "Reap polling job record created.",
    metadata: { videoId, reapProjectId },
  });

  try {
    const queueJob = await getReapPollingQueue().add(
      REAP_POLLING_JOB_NAME,
      {
        dbJobId: dbJob.id,
        userId,
        videoId,
        reapProjectId,
      },
      {
        ...reapPollingJobOptions,
        jobId: dbJob.id,
      },
    );

    await logEvent({
      userId,
      jobId: dbJob.id,
      level: "info",
      event: "reap.polling.job.enqueued",
      component: "reap-polling-queue",
      message: "Reap polling job enqueued in BullMQ.",
      metadata: {
        queueName: REAP_POLLING_QUEUE_NAME,
        queueJobId: queueJob.id,
        reapProjectId,
        pollIntervalMs: REAP_POLLING_INTERVAL_MS,
        maxAttempts: REAP_POLLING_MAX_ATTEMPTS,
      },
    });

    return dbJob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to enqueue Reap polling job.";

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
      event: "reap.polling.job.enqueue_failed",
      component: "reap-polling-queue",
      message: "Failed to enqueue Reap polling job in BullMQ.",
      metadata: {
        queueName: REAP_POLLING_QUEUE_NAME,
        errorMessage,
        error: serializeError(error),
      },
    });

    throw error;
  }
}