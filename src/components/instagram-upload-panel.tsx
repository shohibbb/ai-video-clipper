"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { InstagramAccountSelector } from "@/components/instagram-account-selector";
import { StatusBadge } from "@/components/status-badge";

type UploadTargetSummary = {
  id: string;
  platform: string;
  uploadStatus: string;
  uploadedUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type InstagramUploadPanelProps = {
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

export function InstagramUploadPanel({
  clipId,
  storagePath,
  uploadTargets,
}: InstagramUploadPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );

  const latestInstagramUpload = uploadTargets.find(
    (target) => target.platform === "instagram",
  );
  const hasActiveUpload = ["queued", "uploading", "publishing"].includes(
    latestInstagramUpload?.uploadStatus ?? "",
  );
  const uploadFailed = latestInstagramUpload?.uploadStatus === "failed";

  const busy = isPending || isUploading;
  const canUpload =
    storagePath && !hasActiveUpload && !busy && selectedAccountId;

  const statusLabel = hasActiveUpload
    ? (latestInstagramUpload?.uploadStatus ?? "queued")
    : latestInstagramUpload?.uploadStatus === "completed"
      ? "completed"
      : uploadFailed
        ? "failed"
        : "idle";

  async function uploadToInstagram() {
    if (!canUpload) return;

    setIsUploading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/clips/${clipId}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "instagram",
          connectedAccountId: selectedAccountId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to queue Instagram upload");
      }

      setMessage(data.message || "Upload queued successfully");

      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
            Instagram upload
          </p>
          <p className="mt-1 text-sm leading-6 text-[#c6c9ab]">
            Uploads this clip directly to Instagram Reels via Composio.
          </p>
        </div>
        <StatusBadge status={statusLabel} />
      </div>

      {latestInstagramUpload ? (
        <div className="rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] px-4 py-3 text-sm leading-6 text-[#c6c9ab]">
          <p>
            Latest attempt:{" "}
            <span className="font-bold text-[#e2e2e1]">
              {formatDate(latestInstagramUpload.createdAt)}
            </span>
          </p>
          {/* {latestInstagramUpload.uploadedUrl ? (
            <a
              href={latestInstagramUpload.uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-black text-[#dffe00] underline decoration-2 underline-offset-4"
            >
              Open Instagram Reel
            </a>
          ) : null} */}
          {latestInstagramUpload.errorMessage ? (
            <p className="mt-1 font-bold text-[#ffb4ab] break-all whitespace-pre-wrap">
              {latestInstagramUpload.errorMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {!storagePath ? (
        <p className="rounded-lg border border-[#c6c9ab] bg-[rgba(30,32,32,0.70)] px-4 py-3 text-sm font-bold text-[#c6c9ab]">
          This clip needs a storage path before Instagram upload can be queued.
        </p>
      ) : null}

      <InstagramAccountSelector
        selectedAccountId={selectedAccountId}
        onSelect={setSelectedAccountId}
        clipId={clipId}
      />

      <button
        type="button"
        onClick={uploadToInstagram}
        disabled={!canUpload}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {latestInstagramUpload?.uploadStatus === "completed"
          ? "Uploaded to Instagram ✓"
          : hasActiveUpload
            ? "Upload in progress"
            : busy
              ? "Uploading..."
              : uploadFailed
                ? "Retry Instagram upload"
                : "Upload to Instagram Reels"}
      </button>

      {message ? (
        <p className="rounded-lg border border-[#dffe00] bg-[rgba(57,255,20,0.10)] px-4 py-3 text-sm font-bold text-[#dffe00] break-words">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-4 py-3 text-sm font-bold text-[#ffb4ab] break-all">
          {error}
        </p>
      ) : null}
    </section>
  );
}
