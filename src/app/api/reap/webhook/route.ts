import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectClips } from "@/lib/reap";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { getStorageService } from "@/lib/storage";
import type { ReapWebhookPayload, ReapProjectStatus } from "@/lib/reap/types";

const REAP_COMPLETED_STATUSES: ReapProjectStatus[] = ["completed"];
const REAP_FAILED_STATUSES: ReapProjectStatus[] = ["invalid", "expired", "failed", "error"];

export async function POST(request: Request) {
  let payload: ReapWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, projectType, source, status } = payload;

  if (!projectId || !status) {
    return NextResponse.json({ error: "Missing projectId or status" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({
    where: { reapProjectId: projectId },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found for projectId" }, { status: 200 });
  }

  if (REAP_COMPLETED_STATUSES.includes(status)) {
    await handleCompletedProject(video.id, video.userId, projectId);
  } else if (REAP_FAILED_STATUSES.includes(status)) {
    await handleFailedProject(video.id, video.userId, projectId, status);
  }

  return new NextResponse(null, { status: 200 });
}

async function handleCompletedProject(videoId: string, userId: string, reapProjectId: string) {
  await prisma.video.update({
    where: { id: videoId },
    data: { status: "downloading_from_reap" },
  });

  await logEvent({
    userId,
    level: "info",
    event: "reap.webhook.completed",
    component: "reap-webhook",
    message: `Reap project ${reapProjectId} completed. Downloading clips.`,
    metadata: { videoId, reapProjectId },
  });

  try {
    const clipsResponse = await getProjectClips(reapProjectId);
    const clips = clipsResponse.clips;

    if (!clips.length) {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "failed",
          errorMessage: "Reap project completed but returned 0 clips.",
        },
      });
      return;
    }

    const storage = getStorageService();
    let storedClipCount = 0;

    for (const clip of clips) {
      if (!clip.clipUrl) {
        await logEvent({
          userId,
          level: "warning",
          event: "reap.clip.skip_no_url",
          component: "reap-webhook",
          message: `Skipping Reap clip ${clip.id} — no download URL.`,
          metadata: { videoId, reapProjectId, reapClipId: clip.id },
        });
        continue;
      }

      const clipResponse = await fetch(clip.clipUrl);
      if (!clipResponse.ok) {
        await logEvent({
          userId,
          level: "warning",
          event: "reap.clip.download_failed",
          component: "reap-webhook",
          message: `Failed to download Reap clip ${clip.id}: ${clipResponse.status}`,
          metadata: { videoId, reapProjectId, reapClipId: clip.id },
        });
        continue;
      }

      const clipBytes = Buffer.from(await clipResponse.arrayBuffer());
      const clipId = randomUUID();
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
          errorMessage: `Reap project ${reapProjectId} completed but none of ${clips.length} clips could be downloaded.`,
        },
      });
      return;
    }

    await prisma.video.update({
      where: { id: videoId },
      data: { status: "ready_to_upload" },
    });

    await logEvent({
      userId,
      level: "info",
      event: "reap.clips.stored",
      component: "reap-webhook",
      message: `Stored ${storedClipCount}/${clips.length} clips from Reap project ${reapProjectId}.`,
      metadata: { videoId, reapProjectId, storedClipCount, totalClips: clips.length },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to download and store clips from Reap.";

    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "failed",
        errorMessage,
      },
    });

    await logEvent({
      userId,
      level: "error",
      event: "reap.clips.store_failed",
      component: "reap-webhook",
      message: errorMessage,
      metadata: { videoId, reapProjectId, error: serializeError(error) },
    });
  }
}

async function handleFailedProject(videoId: string, userId: string, reapProjectId: string, status: string) {
  const errorMessage = `Reap project ${reapProjectId} failed with status: ${status}`;

  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: "failed",
      errorMessage,
    },
  });

  await logEvent({
    userId,
    level: "error",
    event: "reap.webhook.failed",
    component: "reap-webhook",
    message: errorMessage,
    metadata: { videoId, reapProjectId, status },
  });
}

function randomUUID() {
  return crypto.randomUUID();
}