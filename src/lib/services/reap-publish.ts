import { toJsonValue } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import type { ReapPost } from "@/lib/reap";

export function isTikTokPostCompleted(post: ReapPost) {
  return post.status === "completed" && post.successPlatforms.includes("tiktok");
}

export function isTikTokPostFailed(post: ReapPost) {
  return (
    ["failed", "cancelled", "unresolved"].includes(post.status) ||
    (post.failedPlatforms.includes("tiktok") && !post.successPlatforms.includes("tiktok"))
  );
}

export function isReapPostPending(post: ReapPost) {
  return post.status === "processing" || post.status === "draft";
}

export async function recordPublishingPost(uploadTargetId: string, post: ReapPost) {
  await prisma.uploadTarget.update({
    where: { id: uploadTargetId },
    data: {
      uploadStatus: "publishing",
      reapPostId: post.id,
      platformResponse: toJsonValue(post),
      errorMessage: null,
    },
  });
}

export async function markUploadCompleted(
  uploadTargetId: string,
  clip: { id: string; videoId: string },
  post: { id: string; urls?: Record<string, string> },
) {
  const tiktokUrl = post.urls?.tiktok ?? null;

  await prisma.uploadTarget.update({
    where: { id: uploadTargetId },
    data: {
      uploadStatus: "completed",
      uploadedUrl: tiktokUrl,
      errorMessage: null,
    },
  });

  await prisma.clip.update({
    where: { id: clip.id },
    data: { status: "uploaded" },
  });

  const [totalClips, uploadedClips] = await prisma.$transaction([
    prisma.clip.count({ where: { videoId: clip.videoId } }),
    prisma.clip.count({ where: { videoId: clip.videoId, status: "uploaded" } }),
  ]);

  await prisma.video.update({
    where: { id: clip.videoId },
    data: {
      status: totalClips > 0 && totalClips === uploadedClips ? "completed" : "ready_to_upload",
      errorMessage: null,
    },
  });
}

export async function markUploadFailed(
  uploadTargetId: string,
  clip: { id: string; videoId: string },
  errorMessage: string,
) {
  await prisma.uploadTarget.update({
    where: { id: uploadTargetId },
    data: {
      uploadStatus: "failed",
      errorMessage,
      retryCount: { increment: 1 },
    },
  });

  await prisma.clip.update({
    where: { id: clip.id },
    data: { status: "failed" },
  });

  await prisma.video.update({
    where: { id: clip.videoId },
    data: {
      status: "failed",
      errorMessage,
    },
  });
}
