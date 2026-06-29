import type { Job } from "bullmq";
import { createJobLogger, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { enqueueReapPublishStatusJob } from "@/lib/queue/reap-publish-status-queue";
import { TIKTOK_UPLOAD_MAX_ATTEMPTS } from "@/lib/queue/upload-queue";
import type { ClipUploadJobData } from "@/lib/queue/upload-queue";
import { getIntegrations, getPostDetails, publishClip, ReapApiError, type ReapPost } from "@/lib/reap";
import {
  isReapPostPending,
  isTikTokPostCompleted,
  isTikTokPostFailed,
  markUploadCompleted,
  recordPublishingPost,
} from "@/lib/services/reap-publish";

class TerminalReapPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerminalReapPublishError";
  }
}

export async function processReapPublishJob(job: Job<ClipUploadJobData>) {
  const { dbJobId, userId, clipId, uploadTargetId, platform } = job.data;
  const attempt = job.attemptsMade + 1;
  const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : TIKTOK_UPLOAD_MAX_ATTEMPTS;
  const logger = createJobLogger({
    component: "reap-publish-worker",
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

  await prisma.uploadTarget.update({
    where: { id: uploadTargetId },
    data: {
      uploadStatus: "uploading",
      errorMessage: null,
    },
  });

  try {
    if (platform !== "tiktok") {
      throw new Error("Reap publish worker only supports TikTok for the MVP.");
    }

    const clip = await prisma.clip.findFirst({
      where: { id: clipId, userId },
      include: { video: true },
    });

    if (!clip) {
      throw new Error("Clip not found for Reap publish job.");
    }

    if (!clip.reapClipId) {
      throw new Error("Clip must have a reapClipId before it can be published via Reap.");
    }

    if (!clip.video.reapProjectId) {
      throw new Error("Video must have a reapProjectId before its clips can be published via Reap.");
    }

    const uploadTarget = await prisma.uploadTarget.findUnique({
      where: { id: uploadTargetId },
    });

    if (!uploadTarget) {
      throw new Error("Upload target not found for Reap publish job.");
    }

    await prisma.clip.update({
      where: { id: clip.id },
      data: { status: "uploading" },
    });

    await prisma.video.update({
      where: { id: clip.videoId },
      data: { status: "uploading_to_tiktok", errorMessage: null },
    });

    await job.updateProgress(20);

    await logger.info("Reap publish worker started.", {
      phase: 6,
      queueJobId: job.id,
      attempt,
      maxAttempts,
      clipId,
      uploadTargetId,
      platform,
      reapProjectId: clip.video.reapProjectId,
      reapClipId: clip.reapClipId,
      reapPostId: uploadTarget.reapPostId,
    });

    let post: ReapPost;

    if (uploadTarget.reapPostId) {
      await logger.info("Checking existing Reap post status.", {
        phase: 6,
        clipId,
        uploadTargetId,
        reapPostId: uploadTarget.reapPostId,
      });

      post = await getPostDetails(uploadTarget.reapPostId);
    } else {
      let integrationId = uploadTarget.reapIntegrationId;

      if (!integrationId) {
        await logger.info("No integrationId on upload target. Fetching TikTok integrations from Reap.", {
          phase: 6,
          clipId,
          uploadTargetId,
        });

        const integrationsResponse = await getIntegrations();
        const tiktokIntegration = integrationsResponse.integrations.find(
          (i) => i.platform === "tiktok" && i.isActive,
        );

        if (!tiktokIntegration) {
          const appUrl = process.env.REAP_APP_URL ?? "https://reap.video";
          throw new Error(
            `No active TikTok integration found in Reap. Connect a TikTok account at ${appUrl}/settings/integrations.`,
          );
        }

        integrationId = tiktokIntegration.id;

        await prisma.uploadTarget.update({
          where: { id: uploadTargetId },
          data: { reapIntegrationId: integrationId },
        });
      }

      await job.updateProgress(40);

      await logger.info("Publishing clip to TikTok via Reap.", {
        phase: 6,
        clipId,
        uploadTargetId,
        integrationId,
        reapProjectId: clip.video.reapProjectId,
        reapClipId: clip.reapClipId,
      });

      post = await publishClip({
        projectId: clip.video.reapProjectId,
        clipId: clip.reapClipId,
        integrations: [integrationId],
        title: clip.title ?? undefined,
        description: clip.caption ?? undefined,
        tags: clip.hashtags.length > 0 ? clip.hashtags : undefined,
        platformSettings: {
          tiktok: {
            disableComments: false,
            disableDuet: false,
            disableStitch: false,
          },
        },
      });
    }

    await job.updateProgress(80);

    await recordPublishingPost(uploadTargetId, post);

    await logger.info("Reap post status received.", {
      phase: 6,
      clipId,
      uploadTargetId,
      reapPostId: post.id,
      postStatus: post.status,
      successPlatforms: post.successPlatforms,
      failedPlatforms: post.failedPlatforms,
    });

    if (isTikTokPostCompleted(post)) {
      await markUploadCompleted(uploadTargetId, clip, post);
    } else if (isTikTokPostFailed(post)) {
      const errorMessage = `Reap publish failed for TikTok. Post status: ${post.status}. Failed platforms: ${post.failedPlatforms.join(", ")}`;
      throw new TerminalReapPublishError(errorMessage);
    } else if (isReapPostPending(post)) {
      await enqueueReapPublishStatusJob({
        userId,
        clipId,
        uploadTargetId,
        reapPostId: post.id,
      });

      await logger.info("Reap post still processing; status polling job enqueued.", {
        phase: 6,
        clipId,
        uploadTargetId,
        reapPostId: post.id,
        postStatus: post.status,
      });
    } else {
      throw new Error(`Unexpected Reap post status for TikTok publish: ${post.status}.`);
    }

    await prisma.job.update({
      where: { id: dbJobId },
      data: {
        status: "completed",
        attempts: attempt,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    await job.updateProgress(100);

    return {
      clipId,
      uploadTargetId,
      reapPostId: post.id,
      status: post.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Reap publish worker error.";
    const willRetry = !(error instanceof TerminalReapPublishError) && attempt < maxAttempts;

    await prisma.uploadTarget.update({
      where: { id: uploadTargetId },
      data: {
        uploadStatus: willRetry ? "queued" : "failed",
        errorMessage,
        retryCount: { increment: 1 },
      },
    });

    await prisma.clip.update({
      where: { id: clipId },
      data: { status: willRetry ? "ready_to_upload" : "failed" },
    }).catch(() => {});

    const clipRecord = await prisma.clip.findUnique({ where: { id: clipId } });
    if (clipRecord) {
      await prisma.video.update({
        where: { id: clipRecord.videoId },
        data: {
          status: willRetry ? "ready_to_upload" : "failed",
          errorMessage,
        },
      }).catch(() => {});
    }

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
        ? "Reap publish attempt failed; BullMQ will retry."
        : "Reap publish failed after final attempt.",
      {
        phase: 6,
        attempt,
        maxAttempts,
        willRetry,
        clipId,
        uploadTargetId,
        errorMessage,
        error: serializeError(error),
        isReapApiError: error instanceof ReapApiError,
        reapApiStatus: error instanceof ReapApiError ? error.status : undefined,
      },
    );

    throw error;
  }
}
