import { randomUUID } from "node:crypto";
import type { Job } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import { createJobLogger, serializeError } from "../../src/lib/observability/logger";
import { REAP_MAX_ATTEMPTS } from "../../src/lib/queue/video-queue";
import type { VideoProcessingJobData } from "../../src/lib/queue/video-queue";
import {
  getReapConfig,
  requireReapApiKey,
  getUploadUrl,
  uploadFileToUrl,
  createClips,
  ReapApiError,
} from "../../src/lib/reap";
import { getStorageService } from "../../src/lib/storage";
import { enqueueReapPollingJob } from "../../src/lib/queue/reap-polling-queue";

const MAX_UPLOAD_RETRIES = 3;
const UPLOAD_RETRY_DELAY_MS = 2_000;

async function retryWithDelay<T>(fn: () => Promise<T>, retries: number, delayMs: number): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

async function uploadSourceToReap(sourceStoragePath: string): Promise<string> {
  const storage = getStorageService();
  const sourceFile = await storage.downloadFile(sourceStoragePath);
  const sourceBytes = Buffer.from(await sourceFile.data.arrayBuffer());

  const config = getReapConfig();
  const fileName = sourceStoragePath.split("/").pop() ?? "video.mp4";
  const contentType = sourceFile.contentType ?? "video/mp4";

  if (sourceBytes.length > config.maxSourceVideoUploadMb * 1024 * 1024) {
    throw new Error(
      `Source video exceeds ${config.maxSourceVideoUploadMb} MB limit (${(sourceBytes.length / (1024 * 1024)).toFixed(1)} MB).`,
    );
  }

  const uploadUrlResponse = await retryWithDelay(
    () => getUploadUrl(fileName),
    MAX_UPLOAD_RETRIES,
    UPLOAD_RETRY_DELAY_MS,
  );

  await retryWithDelay(
    () => uploadFileToUrl(uploadUrlResponse.uploadUrl, sourceBytes, contentType),
    MAX_UPLOAD_RETRIES,
    UPLOAD_RETRY_DELAY_MS,
  );

  return uploadUrlResponse.id;
}

export async function processReapVideoJob(job: Job<VideoProcessingJobData>) {
  const { dbJobId, userId, videoId, sourceUrl, sourceStoragePath } = job.data;
  const attempt = job.attemptsMade + 1;
  const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : REAP_MAX_ATTEMPTS;
  const logger = createJobLogger({
    component: "reap-worker",
    userId,
    jobId: dbJobId,
  });

  await prisma.job.update({
    where: { id: dbJobId },
    data: {
      status: "active",
      attempts: attempt,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: "uploading_to_reap",
      errorMessage: null,
    },
  });

  const config = getReapConfig();

  await logger.info("Reap worker started processing.", {
    phase: 2,
    queueJobId: job.id,
    attempt,
    maxAttempts,
    sourceUrl,
    sourceStoragePath,
  });

  try {
    await job.updateProgress(10);

    requireReapApiKey();

    let reapProjectId: string;

    if (sourceUrl) {
      await logger.info("Creating Reap clipping project from URL.", {
        phase: 3,
        videoId,
        sourceUrl,
      });

      const project = await createClips({
        sourceUrl,
        genre: config.defaultGenre as "talking" | "screenshare" | "gaming",
        exportOrientation: config.defaultOrientation as "landscape" | "portrait" | "square",
        exportResolution: config.defaultResolution,
        reframeClips: config.defaultReframe,
        captionsPreset: config.defaultCaptionsPreset,
        enableEmojis: config.defaultEnableEmojis,
        enableHighlights: config.defaultEnableHighlights,
        ...(config.defaultLanguage ? { language: config.defaultLanguage } : {}),
      });

      reapProjectId = project.id;

      await logger.info("Reap project created from URL.", {
        phase: 3,
        videoId,
        reapProjectId,
        projectStatus: project.status,
      });
    } else if (sourceStoragePath) {
      await logger.info("Uploading source file to Reap.", {
        phase: 3,
        videoId,
        sourceStoragePath,
      });

      const uploadId = await uploadSourceToReap(sourceStoragePath);

      await prisma.video.update({
        where: { id: videoId },
        data: { status: "processing_in_reap" },
      });

      await job.updateProgress(30);

      await logger.info("Creating Reap clipping project from upload.", {
        phase: 3,
        videoId,
        uploadId,
      });

      const project = await createClips({
        uploadId,
        genre: config.defaultGenre as "talking" | "screenshare" | "gaming",
        exportOrientation: config.defaultOrientation as "landscape" | "portrait" | "square",
        exportResolution: config.defaultResolution,
        reframeClips: config.defaultReframe,
        captionsPreset: config.defaultCaptionsPreset,
        enableEmojis: config.defaultEnableEmojis,
        enableHighlights: config.defaultEnableHighlights,
        ...(config.defaultLanguage ? { language: config.defaultLanguage } : {}),
      });

      reapProjectId = project.id;

      await logger.info("Reap project created from upload.", {
        phase: 3,
        videoId,
        reapProjectId,
        projectStatus: project.status,
      });
    } else {
      throw new Error("No source URL or source storage path provided for Reap processing.");
    }

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "processing_in_reap",
        reapProjectId,
      },
    });

    await job.updateProgress(50);

    await logger.info("Enqueuing Reap polling job to watch for project completion.", {
      phase: 3,
      videoId,
      reapProjectId,
    });

    try {
      await enqueueReapPollingJob({
        userId,
        videoId,
        reapProjectId,
      });
      await logger.info("Reap polling job enqueued successfully.", {
        phase: 3,
        videoId,
        reapProjectId,
      });
    } catch (pollingError) {
      await logger.warning("Failed to enqueue Reap polling job. Clips will not auto-download. Use manual poll API or webhook.", {
        phase: 3,
        videoId,
        reapProjectId,
        error: serializeError(pollingError),
      });
    }

    await logger.info("Reap project submitted. Polling worker will check for completion.", {
      phase: 3,
      videoId,
      reapProjectId,
      note: "Webhook or polling worker should handle clip download.",
    });

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "completed",
        attempts: attempt,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    return {
      videoId,
      reapProjectId,
      status: "processing_in_reap",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Reap worker error.";
    const willRetry = attempt < maxAttempts;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: willRetry ? "queued" : "failed",
        errorMessage,
        retryCount: { increment: 1 },
      },
    });

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: willRetry ? "queued" : "failed",
        attempts: attempt,
        errorMessage,
        completedAt: willRetry ? null : new Date(),
      },
    });

    await logger.error(
      willRetry
        ? "Reap worker attempt failed; BullMQ will retry."
        : "Reap worker failed after final attempt.",
      {
        phase: 2,
        attempt,
        maxAttempts,
        willRetry,
        errorMessage,
        error: serializeError(error),
        isReapApiError: error instanceof ReapApiError,
        reapApiStatus: error instanceof ReapApiError ? error.status : undefined,
      },
    );

    throw error;
  }
}