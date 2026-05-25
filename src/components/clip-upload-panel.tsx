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
  const hasActiveUpload = ["queued", "uploading", "publishing"].includes(latestTikTokUpload?.uploadStatus ?? "");
  const uploadFailed = latestTikTokUpload?.uploadStatus === "failed";
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

    setMessage("TikTok upload queued. Start npm run worker:reap-publish to process it.");
    setIsUploading(false);
    refresh();
  }

  return (
    <section className="grid gap-3 rounded-[1.5rem] border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-xs font-black uppercase tracking-[0.25em] text-[#dffe00]">TikTok upload</p>
          <p className="mt-1 text-sm leading-6 text-[#c6c9ab]">
            Queues the Reap publish worker with this clip file and current metadata.
          </p>
        </div>
        {latestTikTokUpload ? <StatusBadge status={`tiktok ${latestTikTokUpload.uploadStatus}`} /> : <StatusBadge status="not queued" />}
      </div>

      {latestTikTokUpload ? (
        <div className="rounded-2xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] px-4 py-3 text-sm leading-6 text-[#c6c9ab]">
          <p>
            Latest attempt: <span className="font-bold text-[#e2e2e1]">{formatDate(latestTikTokUpload.createdAt)}</span>
          </p>
          {latestTikTokUpload.uploadedUrl ? (
            <a
              href={latestTikTokUpload.uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="font-black text-[#dffe00] underline decoration-2 underline-offset-4"
            >
              Open uploaded TikTok
            </a>
          ) : null}
          {latestTikTokUpload.errorMessage ? <p className="font-bold text-[#ffb4ab]">{latestTikTokUpload.errorMessage}</p> : null}
        </div>
      ) : null}

      {!storagePath ? (
        <p className="rounded-2xl border border-[#c6c9ab] bg-[rgba(30,32,32,0.70)] px-4 py-3 text-sm font-bold text-[#c6c9ab]">
          This clip needs a storage path before TikTok upload can be queued.
        </p>
      ) : null}

      <button
        type="button"
        onClick={uploadToTikTok}
        disabled={!canUpload}
        className="rounded-2xl bg-[#dffe00] px-5 py-3 font-black text-[#0b0a09] transition hover:-translate-y-0.5 hover:bg-[#39ff14] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {hasActiveUpload ? "Upload in progress" : busy ? "Queueing..." : uploadFailed ? "Retry TikTok upload" : "Upload to TikTok"}
      </button>

      {message ? <p className="rounded-2xl border border-[#dffe00] bg-[rgba(57,255,20,0.10)] px-4 py-3 text-sm font-bold text-[#dffe00]">{message}</p> : null}
      {error ? <p className="rounded-2xl border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-4 py-3 text-sm font-bold text-[#ffb4ab]">{error}</p> : null}
    </section>
  );
}
