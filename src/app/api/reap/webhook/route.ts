import { NextResponse } from "next/server";
import { logEvent, serializeError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { enqueueReapPollingJob } from "@/lib/queue/reap-polling-queue";
import type { ReapProjectStatus, ReapWebhookPayload } from "@/lib/reap/types";

const REAP_COMPLETED_STATUSES: ReapProjectStatus[] = ["completed"];
const REAP_FAILED_STATUSES: ReapProjectStatus[] = ["invalid", "expired", "failed", "error"];

/**
 * Reap sends webhooks when projects reach terminal states.
 * Keep this handler short: it acknowledges Reap, records state, and lets workers do long-running work.
 */
export async function POST(request: Request) {
  let payload: ReapWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, status } = payload;

  if (!projectId || !status) {
    return NextResponse.json({ error: "Missing projectId or status" }, { status: 400 });
  }

  const video = await prisma.video.findFirst({
    where: { reapProjectId: projectId },
  });

  if (!video) {
    await logEvent({
      level: "warning",
      event: "reap.webhook.video_not_found",
      component: "reap-webhook",
      message: `Webhook received for unknown Reap project ${projectId}.`,
      metadata: { projectId, status },
    });

    return new NextResponse(null, { status: 200 });
  }

  if (REAP_COMPLETED_STATUSES.includes(status)) {
    await handleCompletedProject(video.id, video.userId, projectId);
  } else if (REAP_FAILED_STATUSES.includes(status)) {
    await handleFailedProject(video.id, video.userId, projectId, status);
  } else {
    await logEvent({
      userId: video.userId,
      level: "info",
      event: "reap.webhook.ignored_status",
      component: "reap-webhook",
      message: `Webhook received for non-terminal Reap status ${status}.`,
      metadata: { videoId: video.id, reapProjectId: projectId, status },
    });
  }

  return new NextResponse(null, { status: 200 });
}

async function handleCompletedProject(videoId: string, userId: string, reapProjectId: string) {
  try {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "downloading_from_reap",
        errorMessage: null,
      },
    });

    const job = await enqueueReapPollingJob({
      userId,
      videoId,
      reapProjectId,
    });

    await logEvent({
      userId,
      jobId: job.id,
      level: "info",
      event: "reap.webhook.completed_enqueued",
      component: "reap-webhook",
      message: "Reap completion webhook queued clip download work.",
      metadata: { videoId, reapProjectId },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Webhook received, but the clip download job could not be enqueued.";

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
      event: "reap.webhook.enqueue_failed",
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
