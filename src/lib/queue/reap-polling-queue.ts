import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { getReapPollingJobId } from "@/lib/queue/reap-job-identity";
import { createQueueRedisConnection } from "@/lib/queue/redis";

export const REAP_POLLING_QUEUE_NAME = "reap-polling";
export const REAP_POLLING_JOB_NAME = "reap-poll-project";
export const DEFAULT_REAP_POLLING_CONCURRENCY = 1;

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getReapPollingConfig() {
  const initialDelayMs = getPositiveIntegerEnv("REAP_POLLING_INITIAL_DELAY_MS", 900_000);
  const intervalMs = getPositiveIntegerEnv("REAP_POLL_INTERVAL_MS", 300_000);
  const timeoutMs = getPositiveIntegerEnv("REAP_POLL_TIMEOUT_MS", 7_200_000);

  return {
    initialDelayMs,
    intervalMs,
    timeoutMs,
    maxAttempts: Math.max(1, Math.ceil(timeoutMs / intervalMs)),
  };
}

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
  initialDelayMs?: number;
};

function getReapPollingJobOptions(initialDelayMs: number) {
  const config = getReapPollingConfig();

  return {
    attempts: config.maxAttempts,
    delay: initialDelayMs,
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

let reapPollingQueue: Queue<ReapPollingJobData> | null = null;

export function getReapPollingQueue() {
  reapPollingQueue ??= new Queue<ReapPollingJobData>(REAP_POLLING_QUEUE_NAME, {
    connection: createQueueRedisConnection("ai-video-clipper-reap-polling-queue"),
  });

  return reapPollingQueue;
}

export async function enqueueReapPollingJob({
  userId,
  videoId,
  reapProjectId,
  initialDelayMs,
}: ReapPollingJobInput) {
  const config = getReapPollingConfig();
  const delayMs = initialDelayMs ?? config.initialDelayMs;
  const dbJobId = getReapPollingJobId(videoId, reapProjectId);
  const dbJob = await prisma.job.upsert({
    where: { id: dbJobId },
    create: {
      id: dbJobId,
      userId,
      videoId,
      jobType: "reap_process",
      status: "queued",
      maxAttempts: config.maxAttempts,
    },
    update: {},
  });

  if (dbJob.status === "completed") {
    return dbJob;
  }

  const queue = getReapPollingQueue();
  const existingQueueJob = await queue.getJob(dbJob.id);

  if (existingQueueJob) {
    return dbJob;
  }

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
    const queueJob = await queue.add(
      REAP_POLLING_JOB_NAME,
      {
        dbJobId: dbJob.id,
        userId,
        videoId,
        reapProjectId,
      },
      {
        ...getReapPollingJobOptions(delayMs),
        jobId: dbJob.id,
      },
    );

    await prisma.job.update({
      where: { id: dbJob.id },
      data: {
        status: "queued",
        errorMessage: null,
        completedAt: null,
      },
    });

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
        initialDelayMs: delayMs,
        pollIntervalMs: config.intervalMs,
        maxAttempts: config.maxAttempts,
        timeoutMs: config.timeoutMs,
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

export async function cancelReapPollingFallback(videoId: string, reapProjectId: string) {
  const dbJobId = getReapPollingJobId(videoId, reapProjectId);
  const queueJob = await getReapPollingQueue().getJob(dbJobId);

  if (!queueJob) {
    return false;
  }

  const state = await queueJob.getState();

  if (state !== "delayed" && state !== "waiting" && state !== "waiting-children") {
    return false;
  }

  await queueJob.remove();
  await prisma.job.updateMany({
    where: {
      id: dbJobId,
      status: "queued",
    },
    data: {
      status: "cancelled",
      completedAt: new Date(),
      errorMessage: "Polling fallback cancelled after Reap webhook delivery.",
    },
  });

  return true;
}
