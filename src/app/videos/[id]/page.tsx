import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClipMetadataEditor } from "@/components/clip-metadata-editor";
import { ClipPreview } from "@/components/clip-preview";
import { ClipUploadPanel } from "@/components/clip-upload-panel";
import { InstagramUploadPanel } from "@/components/instagram-upload-panel";
import { ReapClippingConfigurator } from "@/components/reap-clipping-configurator";
import { RetryVideoButton } from "@/components/retry-actions";
import { StatusBadge } from "@/components/status-badge";
import { VideoProcessingProgress } from "@/components/video-processing-progress";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReapClippingConfig } from "@/lib/reap/clipping-config";
import { getStorageService } from "@/lib/storage";
import { isVideoProcessingStatus } from "@/lib/video-processing-progress";
import {
  getYouTubeThumbnailUrl,
  isDirectVideoUrl,
  type VideoSourcePreview,
} from "@/lib/video-source-preview";

export const dynamic = "force-dynamic";

type VideoDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ClipWithPreview = {
  id: string;
  storagePath: string | null;
  previewUrl: string | null;
  resolvedPreviewUrl: string | null;
  previewError: string | null;
  durationSeconds: number | null;
  title: string | null;
  caption: string | null;
  hashtags: string[];
  status: string;
  uploadTargets: {
    id: string;
    platform: string;
    uploadStatus: string;
    uploadedUrl: string | null;
    errorMessage: string | null;
    createdAt: string;
  }[];
};

async function resolveClipPreviewUrl(clip: {
  previewUrl: string | null;
  storagePath: string | null;
}) {
  if (clip.previewUrl) {
    return {
      resolvedPreviewUrl: clip.previewUrl,
      previewError: null,
    };
  }

  if (!clip.storagePath) {
    return {
      resolvedPreviewUrl: null,
      previewError: null,
    };
  }

  try {
    const signedUrl = await getStorageService().getSignedUrl(
      clip.storagePath,
      60 * 30,
    );
    return {
      resolvedPreviewUrl: signedUrl.signedUrl,
      previewError: null,
    };
  } catch (error) {
    return {
      resolvedPreviewUrl: null,
      previewError:
        error instanceof Error
          ? error.message
          : "Unable to create a signed preview URL.",
    };
  }
}

async function resolveSourcePreview(video: {
  sourceUrl: string | null;
  sourceStoragePath: string | null;
}): Promise<VideoSourcePreview | null> {
  if (video.sourceUrl) {
    const thumbnailUrl = getYouTubeThumbnailUrl(video.sourceUrl);

    if (thumbnailUrl) {
      return {
        kind: "image",
        url: thumbnailUrl,
      };
    }

    if (isDirectVideoUrl(video.sourceUrl)) {
      return {
        kind: "video",
        url: video.sourceUrl,
      };
    }
  }

  if (!video.sourceStoragePath) {
    return null;
  }

  try {
    const signedUrl = await getStorageService().getSignedUrl(
      video.sourceStoragePath,
      60 * 30,
    );
    return {
      kind: "video",
      url: signedUrl.signedUrl,
    };
  } catch {
    return null;
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function VideoDetailPage({
  params,
}: VideoDetailPageProps) {
  const user = await requireCurrentUser();
  const { id } = await params;

  const video = await prisma.video.findFirst({
    where: {
      id,
      userId: user.id,
    },
    include: {
      clips: {
        include: {
          uploadTargets: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      jobs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
  });

  if (!video) {
    notFound();
  }

  const clips: ClipWithPreview[] = await Promise.all(
    video.clips.map(async (clip) => {
      const preview = await resolveClipPreviewUrl(clip);

      return {
        id: clip.id,
        storagePath: clip.storagePath,
        previewUrl: clip.previewUrl,
        resolvedPreviewUrl: preview.resolvedPreviewUrl,
        previewError: preview.previewError,
        durationSeconds: clip.durationSeconds,
        title: clip.title,
        caption: clip.caption,
        hashtags: clip.hashtags,
        status: clip.status,
        uploadTargets: clip.uploadTargets.map((target) => ({
          id: target.id,
          platform: target.platform,
          uploadStatus: target.uploadStatus,
          uploadedUrl: target.uploadedUrl,
          errorMessage: target.errorMessage,
          createdAt: target.createdAt.toISOString(),
        })),
      };
    }),
  );

  const displayTitle =
    video.title ||
    video.sourceUrl ||
    video.sourceStoragePath ||
    "Untitled video task";
  const canConfigureClipping = ["pending", "failed", "cancelled"].includes(
    video.status,
  );
  const isProcessing = isVideoProcessingStatus(video.status);
  const sourcePreview = isProcessing ? await resolveSourcePreview(video) : null;
  const clippingConfig = readReapClippingConfig(video.reapConfig);

  return (
    <AppShell
      eyebrow="Video Detail"
      title={
        isProcessing
          ? "Your video is moving through the clipping pipeline."
          : "Review clips, tune captions, keep the queue honest."
      }
      description={
        isProcessing
          ? "Follow each workflow stage here. This page refreshes automatically while Reap processes and stores your clips."
          : "Clip preview and metadata editing are live. Caption generation is intentionally safe and returns a clear placeholder when no AI key is configured."
      }
      activeHref="/videos"
    >
      <div className="grid gap-5 lg:grid-cols-12">
        <section className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl lg:col-span-4">
          <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
            Task ID
          </p>
          <h2 className="mt-3 break-all font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-white">
            {video.id}
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            <StatusBadge status={video.status} />
            <StatusBadge status={`${clips.length} clips`} />
          </div>

          <div className="mt-6 grid gap-4 text-sm leading-7 text-[#c6c9ab]">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
                Source
              </p>
              <p className="break-all text-[#e2e2e1]">{displayTitle}</p>
            </div>
            <div>
              <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
                Created
              </p>
              <p>{formatDate(video.createdAt)}</p>
            </div>
            {video.errorMessage ? (
              <div className="rounded-lg border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-4 py-3 text-[#ffb4ab]">
                <p className="font-black">Last error</p>
                <p>{video.errorMessage}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/videos"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] hover:text-[#dffe00]"
            >
              Back to video list
            </Link>
            {["failed", "cancelled"].includes(video.status) ? (
              <RetryVideoButton id={video.id} label="Retry task" />
            ) : null}
          </div>
        </section>

        {canConfigureClipping ? (
          <div className="lg:col-span-8">
            <ReapClippingConfigurator
              videoId={video.id}
              sourceLabel={displayTitle}
              initialConfig={clippingConfig}
            />
          </div>
        ) : (
          <section className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl lg:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
                  {isProcessing ? "Processing Monitor" : "Clip Review"}
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">
                  {isProcessing
                    ? "Clips are being prepared"
                    : clips.length
                      ? `${clips.length} clip${clips.length === 1 ? "" : "s"} ready for metadata`
                      : "No clips generated yet"}
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#c6c9ab]">
                {isProcessing
                  ? "You can leave this page. Processing continues in the worker and the latest stage will appear here."
                  : "Prepare metadata, then queue TikTok upload through the Reap publish worker."}
              </p>
            </div>

            <div className="mt-6 grid gap-6">
              {isProcessing ? (
                <VideoProcessingProgress
                  status={video.status}
                  sourceTitle={displayTitle}
                  sourcePreview={sourcePreview}
                />
              ) : clips.length ? (
                clips.map((clip, index) => (
                  <article
                    key={clip.id}
                    className="grid items-start gap-5 rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4 lg:grid-cols-[minmax(15rem,0.62fr)_1fr]"
                  >
                    <ClipPreview
                      title={clip.title || `Clip ${index + 1}`}
                      status={clip.status}
                      previewUrl={clip.resolvedPreviewUrl}
                      storagePath={clip.storagePath}
                      previewError={clip.previewError}
                    />

                    <div className="grid content-start gap-5 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={clip.status} />
                        {clip.durationSeconds ? (
                          <StatusBadge status={`${clip.durationSeconds}s`} />
                        ) : null}
                        {clip.uploadTargets.map((target) => (
                          <StatusBadge
                            key={target.id}
                            status={`${target.platform} ${target.uploadStatus}`}
                          />
                        ))}
                      </div>

                      <div>
                        <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
                          Clip ID
                        </p>
                        <p className="mt-1 break-all font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-[#c6c9ab]">
                          {clip.id}
                        </p>
                      </div>

                      <ClipMetadataEditor
                        clip={{
                          id: clip.id,
                          title: clip.title,
                          caption: clip.caption,
                          hashtags: clip.hashtags,
                        }}
                      />

                      <div className="grid gap-5">
                        <ClipUploadPanel
                          clipId={clip.id}
                          storagePath={clip.storagePath}
                          uploadTargets={clip.uploadTargets}
                        />

                        <InstagramUploadPanel
                          clipId={clip.id}
                          storagePath={clip.storagePath}
                          uploadTargets={clip.uploadTargets}
                        />
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-8 text-center">
                  <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
                    Awaiting output
                  </p>
                  <h3 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black tracking-[-0.04em] text-white">
                    No clip records yet.
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl leading-7 text-[#c6c9ab]">
                    Once the Reap worker creates clip records, this panel will
                    show previews and editable metadata.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <section className="mt-5 rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
        <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
          Recent Worker Timeline
        </p>
        <div className="mt-4 grid gap-3">
          {video.jobs.length ? (
            video.jobs.map((job) => (
              <div
                key={job.id}
                className="grid gap-3 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-3 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="font-[family-name:var(--font-display)] font-black tracking-[-0.04em] text-white">
                    {job.jobType.replaceAll("_", " ")}
                  </p>
                  <p className="text-sm text-[#c6c9ab]">
                    {formatDate(job.createdAt)}
                  </p>
                  {job.errorMessage ? (
                    <p className="mt-1 text-sm font-bold text-[#ffb4ab]">
                      {job.errorMessage}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-3 text-sm font-bold text-[#c6c9ab]">
              No jobs recorded yet.
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
