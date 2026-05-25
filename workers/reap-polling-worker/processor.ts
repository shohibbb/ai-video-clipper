import { Worker } from "bullmq";
import { createJobLogger, logEvent, serializeError } from "@/lib/observability/logger";
import { createWorkerRedisConnection } from "@/lib/queue/redis";
import { prisma } from "@/lib/prisma";
import {
  REAP_POLLING_QUEUE_NAME,
  REAP_POLLING_MAX_ATTEMPTS,
  type ReapPollingJobData,
} from "@/lib/queue/reap-polling-queue";
import { getProjectStatus } from "@/lib/reap/api";
import type { ReapProjectStatus } from "@/lib/reap/types";
import { storeReapProjectClips } from "@/lib/services/reap-clips";

const COMPLETED_STATUSES: ReapProjectStatus[] = ["completed"];
const FAILED_STATUSES: ReapProjectStatus[] = ["invalid", "expired", "failed", "error"];
const IN_PROGRESS_STATUSES: ReapProjectStatus[] = ["queued", "prepped", "draft", "processing", "finalizing"];

export async function processReapPollingJob(job: { data: ReapPollingJobData; id?: string; attemptsMade: number; opts?: { attempts?: number } }) {
  const { dbJobId, userId, videoId, reapProjectId } = job.data;
  const attempt = job.attemptsMade + 1;
  const logger = createJobLogger({ component: "reap-polling", userId, jobId: dbJobId });

  await prisma.job.update({
    where: { id: dbJobId },
    data: {
      status: "active",
      attempts: attempt,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  await logger.info("Polling Reap project status.", {
    phase: 4,
    videoId,
    reapProjectId,
    attempt,
  });

  const statusResponse = await getProjectStatus(reapProjectId);
  const { status } = statusResponse;

  if (IN_PROGRESS_STATUSES.includes(status)) {
    const retryMessage = `Reap project ${reapProjectId} still processing (status: ${status}). Will retry on next poll.`;

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "queued",
        attempts: attempt,
        errorMessage: retryMessage,
      },
    });

    await logger.info("Reap project still processing. Will retry.", {
      phase: 4,
      videoId,
      reapProjectId,
      status,
    });

    throw new Error(retryMessage);
  }

  if (COMPLETED_STATUSES.includes(status)) {
    const result = await storeReapProjectClips({
      userId,
      videoId,
      reapProjectId,
      jobId: dbJobId,
      component: "reap-polling",
    });

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: result.status === "completed" ? "completed" : "failed",
        errorMessage: result.errorMessage ?? null,
        completedAt: new Date(),
      },
    });

    return { videoId, reapProjectId, ...result };
  }

  if (FAILED_STATUSES.includes(status)) {
    const errorMessage = `Reap project ${reapProjectId} failed with status: ${status}`;

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "failed", errorMessage },
    });

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      },
    });

    await logger.error("Reap project failed.", {
      phase: 4,
      videoId,
      reapProjectId,
      status,
    });

    return { videoId, reapProjectId, status: "failed" };
  }

  throw new Error(`Unknown Reap project status: ${status}. Will retry.`);
}

export function startReapPollingWorker(concurrency = 1) {
  const worker = new Worker<ReapPollingJobData>(REAP_POLLING_QUEUE_NAME, processReapPollingJob, {
    connection: createWorkerRedisConnection(),
    concurrency,
  });

  worker.on("completed", async (job) => {
    await logEvent({
      userId: job.data.userId,
      jobId: job.data.dbJobId,
      level: "info",
      event: "reap.polling.completed",
      component: "reap-polling",
      message: `Reap polling job ${job.id} completed.`,
      metadata: { videoId: job.data.videoId, reapProjectId: job.data.reapProjectId },
    });
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const willRetry = job.attemptsMade < (job.opts.attempts ?? REAP_POLLING_MAX_ATTEMPTS);
    const errorMessage = err instanceof Error ? err.message : "Reap polling job failed.";

    if (!willRetry) {
      await prisma.job.update({
        where: { id: job.data.dbJobId },
        data: {
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        },
      });

      await prisma.video.update({
        where: { id: job.data.videoId },
        data: {
          status: "failed",
          errorMessage,
        },
      });
    }

    await logEvent({
      userId: job.data.userId,
      jobId: job.data.dbJobId,
      level: willRetry ? "warning" : "error",
      event: willRetry ? "reap.polling.retry" : "reap.polling.failed",
      component: "reap-polling",
      message: willRetry
        ? `Reap polling job ${job.id} attempt ${job.attemptsMade} failed. Will retry.`
        : `Reap polling job ${job.id} failed after final attempt.`,
      metadata: { videoId: job.data.videoId, reapProjectId: job.data.reapProjectId, error: serializeError(err) },
    });
  });

  return worker;
}
