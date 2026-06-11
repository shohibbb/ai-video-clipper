"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  getVideoProcessingProgress,
  isVideoProcessingStatus,
  videoProcessingStages,
} from "@/lib/video-processing-progress";
import type { VideoSourcePreview } from "@/lib/video-source-preview";

type VideoProcessingProgressProps = {
  status: string;
  sourceTitle: string;
  sourcePreview: VideoSourcePreview | null;
};

export function VideoProcessingProgress({
  status,
  sourceTitle,
  sourcePreview,
}: VideoProcessingProgressProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [mediaFailed, setMediaFailed] = useState(false);
  const progress = getVideoProcessingProgress(status);

  useEffect(() => {
    if (!isVideoProcessingStatus(status)) {
      return;
    }

    const refresh = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      startRefresh(() => {
        router.refresh();
      });
    };

    const intervalId = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [router, status]);

  if (!progress) {
    return null;
  }

  return (
    <div className="grid gap-6">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-[rgba(223,254,0,0.18)] bg-[#101210]">
        {!mediaFailed && sourcePreview?.kind === "image" ? (
          <img
            src={sourcePreview.url}
            alt={`Source preview for ${sourceTitle}`}
            referrerPolicy="no-referrer"
            onError={() => setMediaFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : null}

        {!mediaFailed && sourcePreview?.kind === "video" ? (
          <video
            src={sourcePreview.url}
            aria-label={`Source preview for ${sourceTitle}`}
            muted
            playsInline
            preload="metadata"
            onError={() => setMediaFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : null}

        {mediaFailed || !sourcePreview ? (
          <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#171916_0%,#242821_52%,#111310_100%)]">
            <div className="grid max-w-sm gap-3 px-8 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full border border-[rgba(223,254,0,0.24)] bg-[rgba(11,10,9,0.72)] font-[family-name:var(--font-display)] text-2xl font-black text-[#dffe00]">
                AI
              </span>
              <p className="line-clamp-2 font-[family-name:var(--font-display)] text-xl font-black text-white">
                {sourceTitle}
              </p>
            </div>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(transparent,rgba(5,7,6,0.96))] px-5 pb-5 pt-20">
          <div className="flex min-w-0 items-end gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full border border-[rgba(223,254,0,0.45)] bg-[rgba(11,10,9,0.80)] shadow-[0_0_28px_rgba(223,254,0,0.14)]">
              <span className="size-6 animate-spin rounded-full border-[3px] border-[rgba(223,254,0,0.20)] border-t-[#dffe00]" />
            </span>
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.20em] text-[#dffe00]">
                Processing source
              </p>
              <p className="mt-1 truncate font-[family-name:var(--font-display)] text-lg font-black text-white">
                {sourceTitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div aria-live="polite" className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.20em] text-[#dffe00]">
              Stage {progress.stageNumber} of {progress.totalStages}
            </p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-black text-white">
              {progress.label}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#c6c9ab]">
              {progress.description}
            </p>
          </div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.14em] text-[#909378]">
            {isRefreshing ? "Checking status..." : "Updates automatically"}
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Video clipping progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.progress}
          className="relative h-3 overflow-hidden rounded-full border border-[rgba(223,254,0,0.18)] bg-[#0c0f0e]"
        >
          <div
            className="relative h-full overflow-hidden rounded-full bg-[#dffe00] transition-[width] duration-700 ease-out"
            style={{ width: `${progress.progress}%` }}
          >
            <span className="absolute inset-0 animate-[pulse_1.8s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {videoProcessingStages.map((stage, index) => {
            const isComplete = index < progress.stageIndex;
            const isActive = index === progress.stageIndex;

            return (
              <div key={stage.status} className="min-w-0">
                <div
                  className={`h-1 rounded-full ${
                    isComplete
                      ? "bg-[#39ff14]"
                      : isActive
                        ? "bg-[#dffe00]"
                        : "bg-[rgba(144,147,120,0.24)]"
                  }`}
                />
                <p
                  className={`mt-2 truncate font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-[0.08em] ${
                    isActive ? "text-[#dffe00]" : isComplete ? "text-[#39ff14]" : "text-[#72755f]"
                  }`}
                  title={stage.label}
                >
                  {stage.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
