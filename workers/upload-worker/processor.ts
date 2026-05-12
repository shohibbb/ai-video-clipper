import type { Job } from "bullmq";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { getComposioTikTokConfig } from "../../src/lib/composio/config";
import { uploadClipToTikTok } from "../../src/lib/composio";
import { getStorageService } from "../../src/lib/storage";
import { TIKTOK_UPLOAD_MAX_ATTEMPTS } from "../../src/lib/queue/upload-queue";
import type { ClipUploadJobData } from "../../src/lib/queue/upload-queue";

type LogInput = {
  jobId: string;
  userId: string;
  level: "info" | "warning" | "error";
  message: string;
  metadata?: Prisma.InputJsonValue;
};

type ClipForUpload = Prisma.ClipGetPayload<{
  include: {
    video: true;
  };
}>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  } catch {
    return {
      value: String(value),
    };
  }
}

async function createLog({ jobId, userId, level, message, metadata }: LogInput) {
  await prisma.log.create({
    data: {
      jobId,
      userId,
      level,
      message,
      metadata,
    },
  });
}

async function updateVideoStatusAfterSuccessfulUpload(videoId: string) {
  const [totalClips, uploadedClips] = await prisma.$transaction([
    prisma.clip.count({
      where: {
        videoId,
      },
    }),
    prisma.clip.count({
      where: {
        videoId,
        status: "uploaded",
      },
    }),
  ]);

  await prisma.video.update({
    where: {
      id: videoId,
    },
    data: {
      status: totalClips > 0 && totalClips === uploadedClips ? "completed" : "ready_to_upload",
      errorMessage: null,
    },
  });
}

export async function processClipUploadJob(job: Job<ClipUploadJobData>) {
  const { dbJobId, userId, clipId, uploadTargetId, platform } = job.data;
  const attempt = job.attemptsMade + 1;
  const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : TIKTOK_UPLOAD_MAX_ATTEMPTS;

  await prisma.job.update({
    where: {
      id: dbJobId,
    },
    data: {
      status: "active",
      attempts: attempt,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  await prisma.uploadTarget.update({
    where: {
      id: uploadTargetId,
    },
    data: {
      uploadStatus: "uploading",
      errorMessage: null,
    },
  });

  await job.updateProgress(10);

  let clip: ClipForUpload | null = null;

  try {
    clip = await prisma.clip.findFirst({
      where: {
        id: clipId,
        userId,
      },
      include: {
        video: true,
      },
    });

    if (!clip) {
      throw new Error("Clip not found for TikTok upload job.");
    }

    await prisma.clip.update({
      where: {
        id: clip.id,
      },
      data: {
        status: "uploading",
      },
    });

    await prisma.video.update({
      where: {
        id: clip.videoId,
      },
      data: {
        status: "uploading_to_tiktok",
        errorMessage: null,
      },
    });

    await createLog({
      jobId: dbJobId,
      userId,
      level: "info",
      message: "TikTok upload worker started.",
      metadata: {
        phase: 6,
        queueJobId: job.id,
        attempt,
        maxAttempts,
        clipId,
        uploadTargetId,
        platform,
      },
    });

    if (platform !== "tiktok") {
      throw new Error("Upload worker only supports TikTok for the MVP.");
    }

    if (!clip.storagePath) {
      throw new Error("Clip must have a storage path before it can be uploaded to TikTok.");
    }

    const config = getComposioTikTokConfig();
    const signedUrl = await getStorageService().getSignedUrl(clip.storagePath, config.signedUrlExpiresInSeconds);

    await job.updateProgress(35);

    await createLog({
      jobId: dbJobId,
      userId,
      level: "info",
      message: "Generated signed clip URL for Composio upload staging.",
      metadata: {
        phase: 6,
        clipId,
        uploadTargetId,
        storagePath: clip.storagePath,
        expiresInSeconds: signedUrl.expiresInSeconds,
      },
    });

    const uploadResult = await uploadClipToTikTok({
      userId,
      clipId,
      uploadTargetId,
      fileUrl: signedUrl.signedUrl,
      storagePath: clip.storagePath,
      title: clip.title,
      caption: clip.caption,
      hashtags: clip.hashtags,
    });

    await job.updateProgress(90);

    await prisma.uploadTarget.update({
      where: {
        id: uploadTargetId,
      },
      data: {
        uploadStatus: "completed",
        uploadedUrl: uploadResult.uploadedUrl,
        platformResponse: toJsonValue(uploadResult.platformResponse),
        errorMessage: null,
      },
    });

    await prisma.clip.update({
      where: {
        id: clip.id,
      },
      data: {
        status: "uploaded",
      },
    });

    await updateVideoStatusAfterSuccessfulUpload(clip.videoId);

    await prisma.job.update({
      where: {
        id: dbJobId,
      },
      data: {
        status: "completed",
        attempts: attempt,
        completedAt: new Date(),
        errorMessage: null,
      },
    });

    await createLog({
      jobId: dbJobId,
      userId,
      level: "info",
      message: "TikTok upload completed through Composio.",
      metadata: {
        phase: 6,
        clipId,
        uploadTargetId,
        uploadedUrl: uploadResult.uploadedUrl,
        composioFile: uploadResult.fileUpload,
        response: toJsonValue(uploadResult.platformResponse),
      },
    });

    await job.updateProgress(100);

    return {
      clipId,
      uploadTargetId,
      uploadedUrl: uploadResult.uploadedUrl,
      status: "completed",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown TikTok upload worker error.";
    const willRetry = attempt < maxAttempts;

    await prisma.uploadTarget.update({
      where: {
        id: uploadTargetId,
      },
      data: {
        uploadStatus: willRetry ? "queued" : "failed",
        errorMessage,
        retryCount: {
          increment: 1,
        },
      },
    });

    if (clip) {
      await prisma.clip.update({
        where: {
          id: clip.id,
        },
        data: {
          status: willRetry ? "ready_to_upload" : "failed",
        },
      });

      await prisma.video.update({
        where: {
          id: clip.videoId,
        },
        data: {
          status: willRetry ? "ready_to_upload" : "failed",
          errorMessage,
        },
      });
    }

    await prisma.job.update({
      where: {
        id: dbJobId,
      },
      data: {
        status: willRetry ? "queued" : "failed",
        attempts: attempt,
        errorMessage,
        completedAt: willRetry ? null : new Date(),
      },
    });

    await createLog({
      jobId: dbJobId,
      userId,
      level: "error",
      message: willRetry ? "TikTok upload attempt failed; BullMQ will retry." : "TikTok upload failed after final attempt.",
      metadata: {
        phase: 6,
        attempt,
        maxAttempts,
        willRetry,
        clipId,
        uploadTargetId,
        errorMessage,
      },
    });

    throw error;
  }
}
