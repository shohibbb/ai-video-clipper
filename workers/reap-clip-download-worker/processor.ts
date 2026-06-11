import { Worker } from "bullmq";
import { createJobLogger, logEvent, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import {
  REAP_CLIP_DOWNLOAD_MAX_ATTEMPTS,
  REAP_CLIP_DOWNLOAD_QUEUE_NAME,
  type ReapClipDownloadJobData,
} from "@/lib/queue/reap-clip-download-queue";
import { createWorkerRedisConnection } from "@/lib/queue/redis";
import { getBullMqWorkerMaintenanceOptions } from "@/lib/queue/worker-options";
import { storeReapProjectClips } from "@/lib/services/reap-clips";

export async function processReapClipDownloadJob(job: {
  data: ReapClipDownloadJobData;
  id?: string;
  attemptsMade: number;
  opts?: { attempts?: number };
}) {
  const { dbJobId, userId, videoId, reapProjectId } = job.data;
  const attempt = job.attemptsMade + 1;
  const logger = createJobLogger({ component: "reap-download", userId, jobId: dbJobId });

  await prisma.job.update({
    where: { id: dbJobId },
    data: {
      status: "active",
      attempts: attempt,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  await logger.info("Downloading completed Reap project clips.", {
    phase: 4,
    videoId,
    reapProjectId,
    attempt,
  });

  const result = await storeReapProjectClips({
    userId,
    videoId,
    reapProjectId,
    jobId: dbJobId,
    component: "reap-download",
  });

  if (result.status !== "completed") {
    throw new Error(result.errorMessage ?? `Reap clip download failed with status ${result.status}.`);
  }

  await prisma.job.update({
    where: { id: dbJobId },
    data: {
      status: "completed",
      attempts: attempt,
      errorMessage: null,
      completedAt: new Date(),
    },
  });

  return { videoId, reapProjectId, ...result };
}

export function startReapClipDownloadWorker(concurrency = 1) {
  const worker = new Worker<ReapClipDownloadJobData>(
    REAP_CLIP_DOWNLOAD_QUEUE_NAME,
    processReapClipDownloadJob,
    {
      connection: createWorkerRedisConnection("ai-video-clipper-reap-download-worker"),
      concurrency,
      ...getBullMqWorkerMaintenanceOptions(),
    },
  );

  worker.on("completed", async (job) => {
    await logEvent({
      userId: job.data.userId,
      jobId: job.data.dbJobId,
      level: "info",
      event: "reap.download.completed",
      component: "reap-download",
      message: `Reap clip download job ${job.id} completed.`,
      metadata: {
        videoId: job.data.videoId,
        reapProjectId: job.data.reapProjectId,
      },
    });
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const willRetry = job.attemptsMade < (job.opts.attempts ?? REAP_CLIP_DOWNLOAD_MAX_ATTEMPTS);
    const errorMessage = err instanceof Error ? err.message : "Reap clip download job failed.";

    await prisma.job.update({
      where: { id: job.data.dbJobId },
      data: {
        status: willRetry ? "queued" : "failed",
        attempts: job.attemptsMade,
        errorMessage,
        completedAt: willRetry ? null : new Date(),
      },
    });

    if (!willRetry) {
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
      event: willRetry ? "reap.download.retry" : "reap.download.failed",
      component: "reap-download",
      message: willRetry
        ? `Reap clip download job ${job.id} failed. Will retry.`
        : `Reap clip download job ${job.id} failed after final attempt.`,
      metadata: {
        videoId: job.data.videoId,
        reapProjectId: job.data.reapProjectId,
        error: serializeError(err),
      },
    });
  });

  return worker;
}
