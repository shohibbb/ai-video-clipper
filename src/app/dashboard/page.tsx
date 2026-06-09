import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RetryClipUploadButton, RetryVideoButton } from "@/components/retry-actions";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { requireCurrentUser } from "@/lib/auth";
import { logPerformanceEvent } from "@/lib/observability/performance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function DashboardPage() {
  const startedAt = performance.now();
  const authStartedAt = performance.now();
  const user = await requireCurrentUser();
  const authDurationMs = performance.now() - authStartedAt;
  const queryStartedAt = performance.now();
  const [totalVideos, totalClips, completedUploads, failedVideos, failedUploads, recentVideos] = await prisma.$transaction([
    prisma.video.count({
      where: {
        userId: user.id,
      },
    }),
    prisma.clip.count({
      where: {
        userId: user.id,
      },
    }),
    prisma.uploadTarget.count({
      where: {
        userId: user.id,
        uploadStatus: "completed",
      },
    }),
    prisma.video.findMany({
      where: {
        userId: user.id,
        status: "failed",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 4,
    }),
    prisma.uploadTarget.findMany({
      where: {
        userId: user.id,
        platform: "tiktok",
        uploadStatus: "failed",
      },
      include: {
        clip: {
          include: {
            video: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 4,
    }),
    prisma.video.findMany({
      where: {
        userId: user.id,
      },
      include: {
        _count: {
          select: {
            clips: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 6,
    }),
  ]);
  const queryDurationMs = performance.now() - queryStartedAt;
  const totalDurationMs = performance.now() - startedAt;
  const failedTaskCount = failedVideos.length + failedUploads.length;

  logPerformanceEvent("dashboard.render.completed", {
    authDurationMs: Math.round(authDurationMs),
    queryDurationMs: Math.round(queryDurationMs),
    totalDurationMs: Math.round(totalDurationMs),
    failedTaskCount,
    recentVideoCount: recentVideos.length,
  });

  return (
    <AppShell
      eyebrow="Mission Control"
      title="Track every clip from raw video to TikTok-ready."
      description="The dashboard now reads live task data, surfaces worker failures, and keeps retry actions close to the error."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Videos" value={String(totalVideos)} />
        <StatCard label="Clips Generated" value={String(totalClips)} tone="moss" />
        <StatCard label="Uploads Complete" value={String(completedUploads)} tone="steel" />
        <StatCard label="Failed Items" value={String(failedTaskCount)} tone="ember" />
      </div>

      <section className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {failedTaskCount ? (
            <section className="rounded-xl border border-[rgba(255,180,171,0.24)] bg-[rgba(255,180,171,0.08)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#ffb4ab]">Needs attention</p>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Failed work is waiting for a retry.</h2>
                </div>
                <Link href="/videos" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#ffb4ab] bg-[rgba(30,32,32,0.70)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#ffb4ab] transition hover:-translate-y-0.5 hover:bg-[rgba(255,180,171,0.10)]">
                  Open ledger
                </Link>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {failedVideos.map((video) => (
                  <article key={video.id} className="grid min-w-0 gap-3 rounded-lg border border-[#ffb4ab]/40 bg-[rgba(30,32,32,0.70)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={video.status} />
                      <StatusBadge status="video task" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-white">{video.title || video.sourceUrl || "Untitled video"}</h3>
                      {video.errorMessage ? <p className="mt-1 line-clamp-2 break-words text-xs font-bold text-[#ffb4ab]">{video.errorMessage}</p> : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link href={`/videos/${video.id}`} className="inline-flex min-h-0 items-center justify-center gap-2 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] hover:text-[#dffe00]">
                        View
                      </Link>
                      <RetryVideoButton id={video.id} compact />
                    </div>
                  </article>
                ))}

                {failedUploads.map((target) => (
                  <article key={target.id} className="grid min-w-0 gap-3 rounded-lg border border-[#ffb4ab]/40 bg-[rgba(30,32,32,0.70)] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status="tiktok failed" />
                      <StatusBadge status="upload task" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-white">{target.clip.title || target.clip.video.title || "TikTok upload"}</h3>
                      {target.errorMessage ? <p className="mt-1 line-clamp-2 break-words text-xs font-bold text-[#ffb4ab]">{target.errorMessage}</p> : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Link href={`/videos/${target.clip.videoId}`} className="inline-flex min-h-0 items-center justify-center gap-2 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] hover:text-[#dffe00]">
                        View
                      </Link>
                      <RetryClipUploadButton id={target.clipId} compact />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-[#dffe00] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Recent task pulse</h2>
                <p className="text-sm text-[#c6c9ab]">Live video tasks ordered by latest activity.</p>
              </div>
              <Link href="/videos/new" className="inline-flex min-h-0 items-center justify-center gap-2 rounded-lg bg-[#d3f000] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14]">
                Add video
              </Link>
            </div>

            <div className="grid gap-3">
              {recentVideos.length ? (
                recentVideos.map((video) => (
                  <Link
                    key={video.id}
                    href={`/videos/${video.id}`}
                    className="grid gap-3 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4 transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.40)] md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <span>
                      <span className="block font-[family-name:var(--font-display)] text-lg font-black tracking-[-0.04em] text-white">{video.title || video.sourceUrl || video.sourceStoragePath || "Untitled video task"}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[13px] font-medium leading-[18px] text-[#c6c9ab]">
                        {video._count.clips} clip{video._count.clips === 1 ? "" : "s"} - Updated {formatDate(video.updatedAt)}
                      </span>
                      {video.errorMessage ? <span className="mt-1 block text-sm font-bold text-[#ffb4ab]">{video.errorMessage}</span> : null}
                    </span>
                    <StatusBadge status={video.status} />
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-6 text-center">
                  <p className="font-[family-name:var(--font-display)] font-black tracking-[-0.04em] text-white">No video tasks yet.</p>
                  <p className="mt-1 text-sm text-[#c6c9ab]">Create a task to start filling the worker timeline.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:col-span-4">
          <section className="rounded-xl border border-[#dffe00] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
            <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">Operator note</p>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Watch the workers, not just the UI.</h2>
            <p className="mt-4 leading-7 text-[#c6c9ab]">
              Use <code className="rounded bg-[rgba(223,254,0,0.10)] px-1 py-0.5 text-[#dffe00]">npm run worker:health</code> to confirm Redis queues and database job counts before retrying failed work.
            </p>
          </section>

          <section className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#c6c9ab]">System telemetry</p>
              <div className="flex gap-1">
                <span className="size-1 rounded-full bg-[#dffe00]" />
                <span className="size-1 rounded-full bg-[#dffe00]" />
                <span className="size-1 rounded-full bg-[#dffe00]" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-end justify-between">
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase text-[#c6c9ab]">Reap limit</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-[#dffe00]">10 req/min</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-[64%] bg-[#dffe00]" />
              </div>

              <div className="flex items-end justify-between">
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium uppercase text-[#c6c9ab]">Queue engine</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-medium text-[#39ff14]">BullMQ</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-[42%] bg-[#39ff14]" />
              </div>

              <div className="border-t border-white/5 pt-4">
                <span className="mb-2 block font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-[0.25em] text-[#c6c9ab]">Failure lanes</span>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`h-8 rounded-sm border ${
                        index < failedTaskCount
                          ? "border-[#ffb4ab]/40 bg-[#ffb4ab]/20"
                          : "border-[#dffe00]/40 bg-[#dffe00]/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}
