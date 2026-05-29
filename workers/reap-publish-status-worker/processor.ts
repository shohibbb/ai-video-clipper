import { Worker } from "bullmq";
import { createJobLogger, logEvent, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import {
  REAP_PUBLISH_STATUS_MAX_ATTEMPTS,
  REAP_PUBLISH_STATUS_QUEUE_NAME,
  type ReapPublishStatusJobData,
} from "@/lib/queue/reap-publish-status-queue";
import { createWorkerRedisConnection } from "@/lib/queue/redis";
import { getPostDetails } from "@/lib/reap";
import {
  isReapPostPending,
  isTikTokPostCompleted,
  isTikTokPostFailed,
  markUploadCompleted,
  markUploadFailed,
  recordPublishingPost,
} from "@/lib/services/reap-publish";

export async function processReapPublishStatusJob(job: { data: ReapPublishStatusJobData; id?: string; attemptsMade: number; opts?: { attempts?: number } }) {
  const { dbJobId, userId, clipId, uploadTargetId, reapPostId } = job.data;
  const attempt = job.attemptsMade + 1;
  const logger = createJobLogger({ component: "reap-publish-status", userId, jobId: dbJobId });

  await prisma.job.update({
    where: { id: dbJobId },
    data: {
      status: "active",
      attempts: attempt,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  const clip = await prisma.clip.findFirst({
    where: { id: clipId, userId },
    select: {
      id: true,
      videoId: true,
    },
  });

  if (!clip) {
    throw new Error("Clip not found for Reap publish status polling job.");
  }

  await logger.info("Checking Reap publish post status.", {
    phase: 6,
    clipId,
    uploadTargetId,
    reapPostId,
    attempt,
  });

  const post = await getPostDetails(reapPostId);

  await recordPublishingPost(uploadTargetId, post);

  if (isTikTokPostCompleted(post)) {
    await markUploadCompleted(uploadTargetId, clip, post);

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "completed",
        attempts: attempt,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    await logger.info("TikTok publish completed.", {
      phase: 6,
      clipId,
      uploadTargetId,
      reapPostId,
      urls: post.urls,
    });

    return { clipId, uploadTargetId, reapPostId, status: "completed" };
  }

  if (isTikTokPostFailed(post)) {
    const errorMessage = `Reap publish failed for TikTok. Post status: ${post.status}. Failed platforms: ${post.failedPlatforms.join(", ")}`;

    await markUploadFailed(uploadTargetId, clip, errorMessage);

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "failed",
        attempts: attempt,
        errorMessage,
        completedAt: new Date(),
      },
    });

    await logger.error("TikTok publish failed.", {
      phase: 6,
      clipId,
      uploadTargetId,
      reapPostId,
      postStatus: post.status,
      failedPlatforms: post.failedPlatforms,
    });

    return { clipId, uploadTargetId, reapPostId, status: "failed" };
  }

  if (isReapPostPending(post)) {
    const retryMessage = `Reap post ${reapPostId} is still ${post.status}. Will retry on next poll.`;

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "queued",
        attempts: attempt,
        errorMessage: retryMessage,
      },
    });

    await logger.info("Reap publish post still processing.", {
      phase: 6,
      clipId,
      uploadTargetId,
      reapPostId,
      postStatus: post.status,
    });

    throw new Error(retryMessage);
  }

  throw new Error(`Unexpected Reap post status for TikTok publish: ${post.status}.`);
}

export function startReapPublishStatusWorker(concurrency = 1) {
  const worker = new Worker<ReapPublishStatusJobData>(REAP_PUBLISH_STATUS_QUEUE_NAME, processReapPublishStatusJob, {
    connection: createWorkerRedisConnection("ai-video-clipper-reap-publish-status-worker"),
    concurrency,
  });

  worker.on("completed", async (job) => {
    await logEvent({
      userId: job.data.userId,
      jobId: job.data.dbJobId,
      level: "info",
      event: "reap.publish_status.completed",
      component: "reap-publish-status",
      message: `Reap publish status job ${job.id} completed.`,
      metadata: {
        clipId: job.data.clipId,
        uploadTargetId: job.data.uploadTargetId,
        reapPostId: job.data.reapPostId,
      },
    });
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const willRetry = job.attemptsMade < (job.opts.attempts ?? REAP_PUBLISH_STATUS_MAX_ATTEMPTS);
    const errorMessage = err instanceof Error ? err.message : "Reap publish status polling job failed.";

    if (!willRetry) {
      await prisma.job.update({
        where: { id: job.data.dbJobId },
        data: {
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        },
      });

      const clip = await prisma.clip.findFirst({
        where: { id: job.data.clipId, userId: job.data.userId },
        select: {
          id: true,
          videoId: true,
        },
      });

      if (clip) {
        await markUploadFailed(job.data.uploadTargetId, clip, errorMessage);
      }
    }

    await logEvent({
      userId: job.data.userId,
      jobId: job.data.dbJobId,
      level: willRetry ? "warning" : "error",
      event: willRetry ? "reap.publish_status.retry" : "reap.publish_status.failed",
      component: "reap-publish-status",
      message: willRetry
        ? `Reap publish status job ${job.id} attempt ${job.attemptsMade} failed. Will retry.`
        : `Reap publish status job ${job.id} failed after final attempt.`,
      metadata: {
        clipId: job.data.clipId,
        uploadTargetId: job.data.uploadTargetId,
        reapPostId: job.data.reapPostId,
        error: serializeError(err),
      },
    });
  });

  return worker;
}
