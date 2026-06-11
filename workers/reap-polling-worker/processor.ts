import { Worker } from "bullmq";
import { createJobLogger, logEvent, serializeError } from "@/lib/observability/logger";
import { createWorkerRedisConnection } from "@/lib/queue/redis";
import { getBullMqWorkerMaintenanceOptions } from "@/lib/queue/worker-options";
import { prisma } from "@/lib/prisma";
import {
  getReapPollingConfig,
  REAP_POLLING_QUEUE_NAME,
  type ReapPollingJobData,
} from "@/lib/queue/reap-polling-queue";
import { enqueueReapClipDownloadJob } from "@/lib/queue/reap-clip-download-queue";
import { getProjectStatus } from "@/lib/reap/api";
import { classifyReapProjectStatus } from "@/lib/reap/project-status";

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
  const statusKind = classifyReapProjectStatus(status);

  if (statusKind === "processing") {
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

  if (statusKind === "completed") {
    const downloadJob = await enqueueReapClipDownloadJob({
      userId,
      videoId,
      reapProjectId,
    });

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "completed",
        errorMessage: null,
        completedAt: new Date(),
      },
    });

    await logger.info("Reap project completed; clip download job enqueued.", {
      phase: 4,
      videoId,
      reapProjectId,
      downloadJobId: downloadJob.id,
    });

    return { videoId, reapProjectId, status: "download_queued", downloadJobId: downloadJob.id };
  }

  if (statusKind === "failed") {
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
}

export function startReapPollingWorker(concurrency = 1) {
  const worker = new Worker<ReapPollingJobData>(REAP_POLLING_QUEUE_NAME, processReapPollingJob, {
    connection: createWorkerRedisConnection(),
    concurrency,
    ...getBullMqWorkerMaintenanceOptions(),
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
    const willRetry = job.attemptsMade < (job.opts.attempts ?? getReapPollingConfig().maxAttempts);
    const errorMessage = willRetry
      ? err instanceof Error
        ? err.message
        : "Reap polling job failed."
      : `Reap project ${job.data.reapProjectId} did not reach a terminal state within the polling fallback window.`;

    if (!willRetry) {
      await prisma.job.update({
        where: { id: job.data.dbJobId },
        data: {
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        },
      });

      await prisma.video.updateMany({
        where: {
          id: job.data.videoId,
          status: "processing_in_reap",
        },
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
