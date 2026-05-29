"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RetryButtonProps = {
  id: string;
  label?: string;
  compact?: boolean;
};

function buttonClassName(compact: boolean) {
  return compact
    ? "inline-flex items-center justify-center rounded-lg border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#ffb4ab] transition hover:-translate-y-0.5 hover:bg-[rgba(255,180,171,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
    : "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#d3f000] px-5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
}

export function RetryVideoButton({ id, label = "Retry video task", compact = false }: RetryButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState("");
  const busy = isPending || isRetrying;

  async function retry() {
    setIsRetrying(true);
    setError("");

    const response = await fetch(`/api/videos/${id}/retry`, {
      method: "POST",
    });
    const result = await response.json();

    setIsRetrying(false);

    if (!response.ok) {
      setError(result.error ?? "Unable to retry video task.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={retry} disabled={busy} className={buttonClassName(compact)}>
        {busy ? "Retrying..." : label}
      </button>
      {error ? <p className="text-xs font-bold text-[#ffb4ab]">{error}</p> : null}
    </div>
  );
}

export function RetryClipUploadButton({ id, label = "Retry TikTok upload", compact = false }: RetryButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState("");
  const busy = isPending || isRetrying;

  async function retry() {
    setIsRetrying(true);
    setError("");

    const response = await fetch(`/api/clips/${id}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: "tiktok",
      }),
    });
    const result = await response.json();

    setIsRetrying(false);

    if (!response.ok) {
      setError(result.error ?? "Unable to retry TikTok upload.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <button type="button" onClick={retry} disabled={busy} className={buttonClassName(compact)}>
        {busy ? "Queueing..." : label}
      </button>
      {error ? <p className="text-xs font-bold text-[#ffb4ab]">{error}</p> : null}
    </div>
  );
}
