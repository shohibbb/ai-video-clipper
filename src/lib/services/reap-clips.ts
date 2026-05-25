import { createHash } from "node:crypto";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { getProjectClips } from "@/lib/reap/api";
import type { ReapClip } from "@/lib/reap/types";
import { getStorageService } from "@/lib/storage";

type StoreReapProjectClipsInput = {
  userId: string;
  videoId: string;
  reapProjectId: string;
  component: string;
  jobId?: string;
};

type StoreReapProjectClipsResult = {
  status: "completed" | "failed_no_clips" | "failed_all_clips";
  storedClipCount: number;
  totalClips: number;
  errorMessage?: string;
};

function formatUuidFromHash(seed: string) {
  const bytes = Buffer.from(createHash("sha256").update(seed).digest("hex").slice(0, 32), "hex");

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getStableClipId(videoId: string, reapClipId: string) {
  return formatUuidFromHash(`${videoId}:${reapClipId}`);
}

function getClipDownloadUrl(clip: ReapClip) {
  return clip.clipWithCaptionsUrl || clip.clipUrl || null;
}

function roundedDurationSeconds(duration: number) {
  return Number.isFinite(duration) ? Math.round(duration) || null : null;
}

export async function storeReapProjectClips({
  userId,
  videoId,
  reapProjectId,
  component,
  jobId,
}: StoreReapProjectClipsInput): Promise<StoreReapProjectClipsResult> {
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "downloading_from_reap" },
  });

  await logEvent({
    userId,
    jobId,
    level: "info",
    event: "reap.clips.download_started",
    component,
    message: `Reap project ${reapProjectId} completed. Downloading clips.`,
    metadata: { videoId, reapProjectId },
  });

  const clipsResponse = await getProjectClips(reapProjectId);
  const clips = clipsResponse.clips;

  if (!clips.length) {
    const errorMessage = `Reap project ${reapProjectId} completed but returned 0 clips.`;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    return {
      status: "failed_no_clips",
      storedClipCount: 0,
      totalClips: 0,
      errorMessage,
    };
  }

  await prisma.video.update({
    where: { id: videoId },
    data: { status: "storing_clips" },
  });

  const storage = getStorageService();
  let storedClipCount = 0;

  for (const clip of clips) {
    const downloadUrl = getClipDownloadUrl(clip);

    if (!downloadUrl) {
      await logEvent({
        userId,
        jobId,
        level: "warning",
        event: "reap.clip.skip_no_url",
        component,
        message: `Skipping Reap clip ${clip.id}; no download URL.`,
        metadata: { videoId, reapProjectId, reapClipId: clip.id },
      });
      continue;
    }

    try {
      const existingClip = await prisma.clip.findFirst({
        where: {
          userId,
          videoId,
          reapClipId: clip.id,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          storagePath: true,
        },
      });
      const clipId = existingClip?.id ?? getStableClipId(videoId, clip.id);
      const storagePath = existingClip?.storagePath ?? `users/${userId}/videos/${videoId}/clips/${clipId}.mp4`;
      const clipResponse = await fetch(downloadUrl);

      if (!clipResponse.ok) {
        await logEvent({
          userId,
          jobId,
          level: "warning",
          event: "reap.clip.download_failed",
          component,
          message: `Failed to download Reap clip ${clip.id}: ${clipResponse.status}`,
          metadata: { videoId, reapProjectId, reapClipId: clip.id, httpStatus: clipResponse.status },
        });
        continue;
      }

      const clipBytes = Buffer.from(await clipResponse.arrayBuffer());

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
          durationSeconds: roundedDurationSeconds(clip.duration),
          title: clip.title ?? `Clip ${storedClipCount + 1}`,
          caption: clip.caption,
          viralityScore: clip.viralityScore,
          sourceStartTime: clip.startTime,
          sourceEndTime: clip.endTime,
          status: "stored",
        },
        update: {
          storagePath,
          durationSeconds: roundedDurationSeconds(clip.duration),
          title: clip.title ?? undefined,
          caption: clip.caption ?? undefined,
          viralityScore: clip.viralityScore ?? undefined,
          sourceStartTime: clip.startTime,
          sourceEndTime: clip.endTime,
          status: "stored",
        },
      });

      storedClipCount += 1;
    } catch (error) {
      await logEvent({
        userId,
        jobId,
        level: "warning",
        event: "reap.clip.store_failed",
        component,
        message: `Failed to store Reap clip ${clip.id}.`,
        metadata: {
          videoId,
          reapProjectId,
          reapClipId: clip.id,
          error: serializeError(error),
        },
      });
    }
  }

  if (storedClipCount === 0) {
    const errorMessage = `Reap project ${reapProjectId} completed but none of ${clips.length} clips could be downloaded and stored.`;

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    return {
      status: "failed_all_clips",
      storedClipCount,
      totalClips: clips.length,
      errorMessage,
    };
  }

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: "ready_to_upload",
      errorMessage: null,
    },
  });

  await logEvent({
    userId,
    jobId,
    level: "info",
    event: "reap.clips.stored",
    component,
    message: `Stored ${storedClipCount}/${clips.length} clips from Reap project ${reapProjectId}.`,
    metadata: { videoId, reapProjectId, storedClipCount, totalClips: clips.length },
  });

  return {
    status: "completed",
    storedClipCount,
    totalClips: clips.length,
  };
}
