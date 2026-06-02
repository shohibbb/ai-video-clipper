import { enqueueVideoProcessingJob } from "@/lib/queue/video-queue";

export type EnqueueableVideo = {
  id: string;
  userId: string;
  sourceUrl: string | null;
  sourceStoragePath: string | null;
};

export async function enqueueVideoOrFail(video: EnqueueableVideo) {
  try {
    return await enqueueVideoProcessingJob({
      userId: video.userId,
      videoId: video.id,
      sourceUrl: video.sourceUrl,
      sourceStoragePath: video.sourceStoragePath,
    });
  } catch {
    return null;
  }
}
