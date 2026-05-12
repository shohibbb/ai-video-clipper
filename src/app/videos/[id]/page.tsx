import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClipMetadataEditor } from "@/components/clip-metadata-editor";
import { ClipPreview } from "@/components/clip-preview";
import { ClipUploadPanel } from "@/components/clip-upload-panel";
import { StatusBadge } from "@/components/status-badge";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageService } from "@/lib/storage";

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

async function resolveClipPreviewUrl(clip: { previewUrl: string | null; storagePath: string | null }) {
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
    const signedUrl = await getStorageService().getSignedUrl(clip.storagePath, 60 * 30);
    return {
      resolvedPreviewUrl: signedUrl.signedUrl,
      previewError: null,
    };
  } catch (error) {
    return {
      resolvedPreviewUrl: null,
      previewError: error instanceof Error ? error.message : "Unable to create a signed preview URL.",
    };
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function VideoDetailPage({ params }: VideoDetailPageProps) {
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

  const displayTitle = video.title || video.sourceUrl || video.sourceStoragePath || "Untitled video task";

  return (
    <AppShell
      eyebrow="Video Detail"
      title="Review clips, tune captions, keep the queue honest."
      description="Clip preview and metadata editing are live. Caption generation is intentionally safe and returns a clear placeholder when no AI key is configured."
    >
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1fr]">
        <section className="rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(30,26,21,0.10)] backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[color:var(--moss)]">Task ID</p>
          <h2 className="mt-3 break-all text-3xl font-black tracking-[-0.05em]">{video.id}</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            <StatusBadge status={video.status} />
            <StatusBadge status={`${clips.length} clips`} />
          </div>

          <div className="mt-6 grid gap-4 text-sm leading-7 text-[color:var(--muted)]">
            <div>
              <p className="font-black uppercase tracking-[0.18em] text-[color:var(--steel)]">Source</p>
              <p className="break-all">{displayTitle}</p>
            </div>
            <div>
              <p className="font-black uppercase tracking-[0.18em] text-[color:var(--steel)]">Created</p>
              <p>{formatDate(video.createdAt)}</p>
            </div>
            {video.errorMessage ? (
              <div className="rounded-2xl border border-[#d45f47] bg-[#ffe4dc] px-4 py-3 text-[#8a2d1d]">
                <p className="font-black">Last error</p>
                <p>{video.errorMessage}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link href="/videos" className="rounded-2xl border border-[color:var(--line)] px-5 py-3 text-center font-black transition hover:border-[color:var(--ember)] hover:text-[color:var(--ember)]">
              Back to video list
            </Link>
            {["failed", "cancelled"].includes(video.status) ? (
              <form action={`/api/videos/${video.id}/retry`} method="post">
                <button className="w-full rounded-2xl bg-[color:var(--ember)] px-5 py-3 font-black text-[#fffaf0] transition hover:-translate-y-0.5" type="submit">
                  Retry task
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[color:var(--line)] bg-[#fffaf0]/80 p-6 shadow-[0_24px_80px_rgba(30,26,21,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[color:var(--moss)]">Clip Review</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                {clips.length ? `${clips.length} clip${clips.length === 1 ? "" : "s"} ready for metadata` : "No clips generated yet"}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[color:var(--muted)]">
              Prepare metadata, then queue TikTok upload through the dedicated Composio worker.
            </p>
          </div>

          <div className="mt-6 grid gap-6">
            {clips.length ? (
              clips.map((clip, index) => (
                <article key={clip.id} className="grid gap-5 rounded-[2rem] border border-[color:var(--line)] bg-[#f7f1e3] p-4 lg:grid-cols-[minmax(15rem,0.62fr)_1fr]">
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
                      {clip.durationSeconds ? <StatusBadge status={`${clip.durationSeconds}s`} /> : null}
                      {clip.uploadTargets.map((target) => (
                        <StatusBadge key={target.id} status={`${target.platform} ${target.uploadStatus}`} />
                      ))}
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-[color:var(--moss)]">Clip ID</p>
                      <p className="mt-1 break-all text-sm text-[color:var(--muted)]">{clip.id}</p>
                    </div>

                    <ClipMetadataEditor
                      clip={{
                        id: clip.id,
                        title: clip.title,
                        caption: clip.caption,
                        hashtags: clip.hashtags,
                      }}
                    />

                    <ClipUploadPanel clipId={clip.id} storagePath={clip.storagePath} uploadTargets={clip.uploadTargets} />
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[2rem] border border-dashed border-[color:var(--line)] bg-[#f7f1e3] p-8 text-center">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[color:var(--moss)]">Awaiting output</p>
                <h3 className="mt-3 text-3xl font-black tracking-[-0.05em]">No clip records yet.</h3>
                <p className="mx-auto mt-3 max-w-xl leading-7 text-[color:var(--muted)]">
                  Once the OpusClip worker creates clip rows, this panel will show previews and editable metadata.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-[2rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(30,26,21,0.08)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[color:var(--moss)]">Recent Worker Timeline</p>
        <div className="mt-4 grid gap-3">
          {video.jobs.length ? (
            video.jobs.map((job) => (
              <div key={job.id} className="grid gap-3 rounded-2xl border border-[color:var(--line)] bg-[#fffaf0]/75 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-black tracking-[-0.03em]">{job.jobType.replaceAll("_", " ")}</p>
                  <p className="text-sm text-[color:var(--muted)]">{formatDate(job.createdAt)}</p>
                  {job.errorMessage ? <p className="mt-1 text-sm font-bold text-[#8a2d1d]">{job.errorMessage}</p> : null}
                </div>
                <StatusBadge status={job.status} />
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-[color:var(--line)] bg-[#fffaf0]/75 px-4 py-3 text-sm font-bold text-[color:var(--muted)]">
              No jobs recorded yet.
            </p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
