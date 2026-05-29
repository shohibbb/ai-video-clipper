import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RetryVideoButton } from "@/components/retry-actions";
import { StatusBadge } from "@/components/status-badge";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function VideosPage() {
  const user = await requireCurrentUser();
  const videos = await prisma.video.findMany({
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
      createdAt: "desc",
    },
  });

  return (
    <AppShell
      eyebrow="Task Ledger"
      title="Every source video, lined up for clipping."
      description="The ledger is database-backed now, with inline errors and retry controls for failed or cancelled video tasks."
      activeHref="/videos"
    >
      <section className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
        <div className="mb-4 flex flex-col gap-3 p-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">Video tasks</h2>
          <Link href="/videos/new" className="inline-flex min-h-0 items-center justify-center gap-2 rounded-lg bg-[#d3f000] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14]">
            Add Video
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-[rgba(223,254,0,0.15)]">
          <div className="hidden grid-cols-[1.15fr_0.9fr_0.45fr_0.6fr_auto] gap-4 bg-[#1e2020] px-5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00] md:grid">
            <span>Video</span>
            <span>Source</span>
            <span>Clips</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {videos.length ? (
            videos.map((video) => (
              <article key={video.id} className="grid gap-4 rounded-none border border-x-0 border-b-0 border-t border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-5 md:grid-cols-[1.15fr_0.9fr_0.45fr_0.6fr_auto] md:items-center">
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-black tracking-[-0.04em] text-white">{video.title || "Untitled video task"}</h3>
                  <p className="text-sm text-[#c6c9ab]">Created {formatDate(video.createdAt)}</p>
                  {video.errorMessage ? <p className="mt-2 rounded-lg border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-3 py-2 text-sm font-bold text-[#ffb4ab]">{video.errorMessage}</p> : null}
                </div>
                <p className="truncate text-sm text-[#c6c9ab]">{video.sourceUrl || video.sourceStoragePath || "No source recorded"}</p>
                <p className="font-[family-name:var(--font-display)] font-black tracking-[-0.04em] text-white">{video._count.clips}</p>
                <StatusBadge status={video.status} />
                <div className="flex flex-col gap-2">
                  <Link href={`/videos/${video.id}`} className="inline-flex min-h-0 items-center justify-center gap-2 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] hover:text-[#dffe00]">
                    View
                  </Link>
                  {["failed", "cancelled"].includes(video.status) ? <RetryVideoButton id={video.id} compact /> : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-none border border-x-0 border-b-0 border-t border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-8 text-center">
              <p className="font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">No video tasks yet.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#c6c9ab]">Create a URL or file upload task and the queue will appear here with retryable failure states.</p>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
