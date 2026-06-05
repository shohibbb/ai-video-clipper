import type { Job } from "@prisma/client";
import { enqueueVideoProcessingJob } from "@/lib/queue/video-queue";

export type EnqueueableVideo = {
  id: string;
  userId: string;
  sourceUrl: string | null;
  sourceStoragePath: string | null;
};

export type VideoEnqueueResult =
  | {
      ok: true;
      job: Job;
    }
  | {
      ok: false;
      errorMessage: string;
    };

export function getVideoEnqueueFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("max requests limit exceeded")) {
    return "Redis request quota has been exceeded. Upgrade or reset the Redis provider quota, or switch REDIS_URL to another Redis instance.";
  }

  if (
    normalizedMessage.includes("econnrefused") ||
    normalizedMessage.includes("enotfound") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("connection")
  ) {
    return "Redis is unavailable. Check REDIS_URL, network access, and whether the Redis service is running.";
  }

  return "Video task was created but could not be enqueued. Check REDIS_URL and Redis availability.";
}

export async function enqueueVideoOrFail(video: EnqueueableVideo) {
  try {
    const job = await enqueueVideoProcessingJob({
      userId: video.userId,
      videoId: video.id,
      sourceUrl: video.sourceUrl,
      sourceStoragePath: video.sourceStoragePath,
    });

    return {
      ok: true,
      job,
    } satisfies VideoEnqueueResult;
  } catch (error) {
    return {
      ok: false,
      errorMessage: getVideoEnqueueFailureMessage(error),
    } satisfies VideoEnqueueResult;
  }
}
