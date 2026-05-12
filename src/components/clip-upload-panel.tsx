"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/status-badge";

type UploadTargetSummary = {
  id: string;
  platform: string;
  uploadStatus: string;
  uploadedUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type ClipUploadPanelProps = {
  clipId: string;
  storagePath: string | null;
  uploadTargets: UploadTargetSummary[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClipUploadPanel({ clipId, storagePath, uploadTargets }: ClipUploadPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const latestTikTokUpload = uploadTargets.find((target) => target.platform === "tiktok");
  const hasActiveUpload = ["queued", "uploading"].includes(latestTikTokUpload?.uploadStatus ?? "");
  const busy = isUploading || isPending;
  const canUpload = Boolean(storagePath) && !hasActiveUpload && !busy;

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function uploadToTikTok() {
    setIsUploading(true);
    setMessage("");
    setError("");

    const response = await fetch(`/api/clips/${clipId}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: "tiktok",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setIsUploading(false);
      setError(result.error ?? "Unable to queue TikTok upload.");
      refresh();
      return;
    }

    setMessage("TikTok upload queued. Start npm run worker:upload to process it.");
    setIsUploading(false);
    refresh();
  }

  return (
    <section className="grid gap-3 rounded-[1.5rem] border border-[color:var(--line)] bg-[#fffaf0]/75 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[color:var(--moss)]">TikTok upload</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
            Queues the Composio upload worker with this clip file and current metadata.
          </p>
        </div>
        {latestTikTokUpload ? <StatusBadge status={`tiktok ${latestTikTokUpload.uploadStatus}`} /> : <StatusBadge status="not queued" />}
      </div>

      {latestTikTokUpload ? (
        <div className="rounded-2xl border border-[color:var(--line)] bg-[#f7f1e3] px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
          <p>
            Latest attempt: <span className="font-bold text-[color:var(--ink)]">{formatDate(latestTikTokUpload.createdAt)}</span>
          </p>
          {latestTikTokUpload.uploadedUrl ? (
            <a
              href={latestTikTokUpload.uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="font-black text-[color:var(--ember)] underline decoration-2 underline-offset-4"
            >
              Open uploaded TikTok
            </a>
          ) : null}
          {latestTikTokUpload.errorMessage ? <p className="font-bold text-[#8a2d1d]">{latestTikTokUpload.errorMessage}</p> : null}
        </div>
      ) : null}

      {!storagePath ? (
        <p className="rounded-2xl border border-[#c49d3c] bg-[#fff4cc] px-4 py-3 text-sm font-bold text-[#6f5010]">
          This clip needs a storage path before TikTok upload can be queued.
        </p>
      ) : null}

      <button
        type="button"
        onClick={uploadToTikTok}
        disabled={!canUpload}
        className="rounded-2xl bg-[color:var(--ember)] px-5 py-3 font-black text-[#fffaf0] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(232,85,47,0.24)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {hasActiveUpload ? "Upload queued" : busy ? "Queueing..." : "Upload to TikTok"}
      </button>

      {message ? <p className="rounded-2xl border border-[#6c8b53] bg-[#e6efdf] px-4 py-3 text-sm font-bold text-[#39502d]">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-[#d45f47] bg-[#ffe4dc] px-4 py-3 text-sm font-bold text-[#8a2d1d]">{error}</p> : null}
    </section>
  );
}
