import { Worker } from "bullmq";
import { createJobLogger, logEvent, serializeError } from "@/lib/observability/logger";
import { createWorkerRedisConnection } from "@/lib/queue/redis";
import { prisma } from "@/lib/prisma";
import {
  REAP_POLLING_QUEUE_NAME,
  REAP_POLLING_JOB_NAME,
  REAP_POLLING_MAX_ATTEMPTS,
  type ReapPollingJobData,
} from "@/lib/queue/reap-polling-queue";
import { getProjectStatus, getProjectClips } from "@/lib/reap/api";
import { getStorageService } from "@/lib/storage";
import type { ReapProjectStatus } from "@/lib/reap/types";

const COMPLETED_STATUSES: ReapProjectStatus[] = ["completed"];
const FAILED_STATUSES: ReapProjectStatus[] = ["invalid", "expired", "failed", "error"];
const IN_PROGRESS_STATUSES: ReapProjectStatus[] = ["queued", "prepped", "draft", "processing", "finalizing"];

export async function processReapPollingJob(job: { data: ReapPollingJobData; id?: string; attemptsMade: number }) {
  const { dbJobId, userId, videoId, reapProjectId } = job.data;
  const logger = createJobLogger({ component: "reap-polling", userId, jobId: dbJobId });

  await logger.info("Polling Reap project status.", {
    phase: 4,
    videoId,
    reapProjectId,
    attempt: job.attemptsMade + 1,
  });

  const statusResponse = await getProjectStatus(reapProjectId);
  const { status } = statusResponse;

  if (IN_PROGRESS_STATUSES.includes(status)) {
    await logger.info("Reap project still processing. Will retry.", {
      phase: 4,
      videoId,
      reapProjectId,
      status,
    });
    throw new Error(`Reap project ${reapProjectId} still processing (status: ${status}). Will retry on next poll.`);
  }

  if (COMPLETED_STATUSES.includes(status)) {
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "downloading_from_reap" },
    });

    await logger.info("Reap project completed. Downloading clips.", {
      phase: 4,
      videoId,
      reapProjectId,
    });

    const clipsResponse = await getProjectClips(reapProjectId);
    const clips = clipsResponse.clips;

    if (!clips.length) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "failed",
          errorMessage: `Reap project ${reapProjectId} completed but returned 0 clips.`,
        },
      });
      return { videoId, reapProjectId, status: "failed_no_clips" };
    }

    const storage = getStorageService();
    let storedClipCount = 0;

    for (const clip of clips) {
      if (!clip.clipUrl) {
        await logger.warning("Skipping Reap clip — no download URL.", {
          phase: 4,
          reapClipId: clip.id,
        });
        continue;
      }

      const clipResponse = await fetch(clip.clipUrl);
      if (!clipResponse.ok) {
        await logger.warning("Failed to download Reap clip.", {
          phase: 4,
          reapClipId: clip.id,
          httpStatus: clipResponse.status,
        });
        continue;
      }

      const clipBytes = Buffer.from(await clipResponse.arrayBuffer());
      const clipId = crypto.randomUUID();
      const storagePath = `users/${userId}/videos/${videoId}/clips/${clipId}.mp4`;

      await storage.uploadFile({
        path: storagePath,
        file: clipBytes,
        contentType: "video/mp4",
        upsert: true,
      });

      await prisma.clip.upsert({
        where: { id: clipId },
        create: {
          id: clipId,
          videoId,
          userId,
          reapClipId: clip.id,
          storagePath,
          durationSeconds: Math.round(clip.duration) || null,
          title: clip.title ?? `Clip ${storedClipCount + 1}`,
          caption: clip.caption,
          viralityScore: clip.viralityScore,
          sourceStartTime: clip.startTime,
          sourceEndTime: clip.endTime,
          status: "stored",
        },
        update: {
          storagePath,
          durationSeconds: Math.round(clip.duration) ?? undefined,
          title: clip.title ?? undefined,
          caption: clip.caption ?? undefined,
          viralityScore: clip.viralityScore ?? undefined,
          sourceStartTime: clip.startTime,
          sourceEndTime: clip.endTime,
          status: "stored",
        },
      });

      storedClipCount += 1;
    }

    if (storedClipCount === 0) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "failed",
          errorMessage: `None of ${clips.length} clips could be downloaded.`,
        },
      });
      return { videoId, reapProjectId, status: "failed_all_clips" };
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "ready_to_upload" },
    });

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    await logger.info("Clips downloaded and stored.", {
      phase: 4,
      videoId,
      reapProjectId,
      storedClipCount,
      totalClips: clips.length,
    });

    return { videoId, reapProjectId, status: "completed", storedClipCount };
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