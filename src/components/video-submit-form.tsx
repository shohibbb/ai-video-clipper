"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ReapClippingConfigurator } from "@/components/reap-clipping-configurator";
import type { ReapClippingConfig } from "@/lib/reap/clipping-config";
import { formatStorageUploadError } from "@/lib/storage/upload-errors";

type SubmitState = "idle" | "submitting" | "success" | "error";
type ActiveStep = "source" | "configure";
type PreparedSource =
  | {
      type: "url";
      sourceUrl: string;
      thumbnailUrl: string | null;
      title: string;
      platform: string;
    }
  | {
      type: "file";
      sourceFile: File;
      title: string;
      platform: string;
    };

type ApiResult = {
  error?: string;
  details?: unknown;
  videoId?: string;
  signedUploadUrl?: string;
};

async function readJsonResponse(response: Response): Promise<ApiResult> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as ApiResult;
  } catch {
    return {
      error: text,
    };
  }
}

function formatApiError(result: ApiResult, fallback: string) {
  const details = typeof result.details === "string" ? result.details : "";

  return [result.error, details].filter(Boolean).join(" ") || fallback;
}

function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const [prefix, id] = url.pathname.split("/").filter(Boolean);

      if (["shorts", "embed", "live"].includes(prefix) && id) {
        return id;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getYouTubeThumbnailUrl(value: string) {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

async function preloadImage(src: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => resolve(false), 1600);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(true);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    image.referrerPolicy = "no-referrer";
    image.src = src;
  });
}

async function uploadToSignedUrl(signedUploadUrl: string, sourceFile: File) {
  const uploadFormData = new FormData();
  uploadFormData.append("cacheControl", "3600");
  uploadFormData.append("", sourceFile);

  const response = await fetch(signedUploadUrl, {
    method: "PUT",
    body: uploadFormData,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(formatStorageUploadError(response.status, body));
  }
}

function StepIndicator({
  activeStep,
  canConfigure,
  onSourceClick,
  onConfigureClick,
}: {
  activeStep: ActiveStep;
  canConfigure: boolean;
  onSourceClick: () => void;
  onConfigureClick: () => void;
}) {
  const steps = [
    {
      id: "source" as const,
      label: "Source",
      description: "Add URL or file",
      disabled: false,
      onClick: onSourceClick,
    },
    {
      id: "configure" as const,
      label: "Configure",
      description: "Choose Reap settings",
      disabled: !canConfigure,
      onClick: onConfigureClick,
    },
  ];

  return (
    <div className="grid gap-3 rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:grid-cols-2">
      {steps.map((step, index) => {
        const isActive = activeStep === step.id;

        return (
          <button
            key={step.id}
            type="button"
            onClick={step.onClick}
            disabled={step.disabled}
            aria-current={isActive ? "step" : undefined}
            suppressHydrationWarning
            className={`grid min-h-16 grid-cols-[auto_1fr] items-center gap-3 rounded-lg border px-4 text-left transition ${
              isActive
                ? "border-[#dffe00] bg-[rgba(223,254,0,0.10)] text-white"
                : "border-[rgba(223,254,0,0.10)] bg-[rgba(30,32,32,0.58)] text-[#c6c9ab] hover:border-[rgba(223,254,0,0.32)] hover:text-[#dffe00]"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span
              className={`grid size-8 place-items-center rounded-full border font-[family-name:var(--font-mono)] text-xs font-black ${
                isActive ? "border-[#dffe00] bg-[#dffe00] text-[#2c3400]" : "border-[rgba(223,254,0,0.20)] text-[#909378]"
              }`}
            >
              {index + 1}
            </span>
            <span className="grid gap-1">
              <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.20em]">{step.label}</span>
              <span className="text-xs font-bold text-[#909378]">{step.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VideoSubmitForm({ initialConfig }: { initialConfig: ReapClippingConfig }) {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string>("");
  const [preparedSource, setPreparedSource] = useState<PreparedSource | null>(null);
  const [activeStep, setActiveStep] = useState<ActiveStep>("source");
  const configureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeStep !== "configure" || !preparedSource) {
      return;
    }

    window.requestAnimationFrame(() => {
      configureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      configureRef.current?.focus({ preventScroll: true });
    });
  }, [activeStep, preparedSource]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const sourceFile = formData.get("sourceFile");
    const hasSourceFile = sourceFile instanceof File && sourceFile.size > 0;
    const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const platform = String(formData.get("platform") ?? "tiktok");

    setState("submitting");
    setMessage("Preparing source preview...");
    await waitForNextPaint();

    if (!hasSourceFile && !sourceUrl) {
      setState("error");
      setMessage("Add a video URL or choose an MP4, MOV, or WEBM file.");
      return;
    }

    if (hasSourceFile) {
      await wait(350);
      setPreparedSource({
        type: "file",
        sourceFile,
        title,
        platform,
      });
      setActiveStep("configure");
      setState("idle");
      setMessage("Source selected. Configure Reap options before queueing.");
      return;
    }

    const thumbnailUrl = getYouTubeThumbnailUrl(sourceUrl);
    const thumbnailReady = thumbnailUrl ? await Promise.race([preloadImage(thumbnailUrl), wait(1600).then(() => false)]) : false;
    await wait(250);

    setPreparedSource({
      type: "url",
      sourceUrl,
      thumbnailUrl: thumbnailReady ? thumbnailUrl : null,
      title,
      platform,
    });
    setActiveStep("configure");
    setState("idle");
    setMessage("Source selected. Configure Reap options before queueing.");
  }

  async function createAndStartClipping(config: ReapClippingConfig) {
    if (!preparedSource) {
      return {
        ok: false as const,
        error: "Add a source video before starting clipping.",
      };
    }

    setState("submitting");

    if (preparedSource.type === "file") {
      setMessage("Creating source draft and signed upload URL...");
      const createResponse = await fetch("/api/videos/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceType: "file",
          fileName: preparedSource.sourceFile.name,
          fileSize: preparedSource.sourceFile.size,
          contentType: preparedSource.sourceFile.type || null,
          title: preparedSource.title,
          platform: preparedSource.platform,
        }),
      });
      const createResult = await readJsonResponse(createResponse);

      if (!createResponse.ok || !createResult.videoId || !createResult.signedUploadUrl) {
        setState("error");
        return {
          ok: false as const,
          error: formatApiError(createResult, "Unable to prepare source video upload."),
        };
      }

      try {
        setMessage("Uploading source video to storage...");
        await uploadToSignedUrl(createResult.signedUploadUrl, preparedSource.sourceFile);
      } catch (error) {
        setState("error");
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : "Unable to upload source video to storage.",
        };
      }

      setMessage("Confirming source upload...");
      const completeResponse = await fetch(`/api/videos/${createResult.videoId}/complete-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: preparedSource.sourceFile.name,
          fileSize: preparedSource.sourceFile.size,
          contentType: preparedSource.sourceFile.type || null,
        }),
      });
      const completeResult = await readJsonResponse(completeResponse);

      if (!completeResponse.ok) {
        setState("error");
        return {
          ok: false as const,
          error: formatApiError(completeResult, "Unable to confirm source upload."),
        };
      }

      setMessage("Queueing clipping job...");
      const startResult = await startExistingVideoClipping(completeResult.videoId || createResult.videoId, config);

      if (!startResult.ok) {
        setState("error");
        return startResult;
      }

      setState("success");
      setMessage("Clipping queued. Redirecting to detail...");
      router.push(`/videos/${completeResult.videoId || createResult.videoId}`);
      return { ok: true as const };
    }

    setMessage("Creating source draft...");
    const response = await fetch("/api/videos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceType: "url",
        sourceUrl: preparedSource.sourceUrl,
        title: preparedSource.title,
        platformTargets: ["tiktok"],
      }),
    });
    const result = await readJsonResponse(response);

    if (!response.ok) {
      setState("error");
      return {
        ok: false as const,
        error: formatApiError(result, "Unable to create video task."),
      };
    }

    if (!result.videoId) {
      setState("error");
      return {
        ok: false as const,
        error: "Video task was created without a video ID.",
      };
    }

    setMessage("Queueing clipping job...");
    const startResult = await startExistingVideoClipping(result.videoId, config);

    if (!startResult.ok) {
      setState("error");
      return startResult;
    }

    setState("success");
    setMessage("Clipping queued. Redirecting to detail...");
    router.push(`/videos/${result.videoId}`);
    return { ok: true as const };
  }

  async function startExistingVideoClipping(videoId: string, config: ReapClippingConfig) {
    const response = await fetch(`/api/videos/${videoId}/start-clipping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    const result = await readJsonResponse(response);

    if (!response.ok) {
      return {
        ok: false as const,
        error: formatApiError(result, "Unable to start clipping."),
      };
    }

    return { ok: true as const };
  }

  if (preparedSource) {
    const sourceLabel =
      preparedSource.type === "file"
        ? preparedSource.title || preparedSource.sourceFile.name
        : preparedSource.title || preparedSource.sourceUrl;
    const sourceThumbnailUrl = preparedSource.type === "url" ? preparedSource.thumbnailUrl : null;
    const sourceMetaLabel = preparedSource.type === "url" && preparedSource.thumbnailUrl ? "YouTube source" : preparedSource.type === "file" ? "Local file" : "URL source";

    return (
      <div className="grid gap-5">
        <StepIndicator
          activeStep={activeStep}
          canConfigure={Boolean(preparedSource)}
          onSourceClick={() => {
            setPreparedSource(null);
            setActiveStep("source");
            setState("idle");
            setMessage("");
          }}
          onConfigureClick={() => setActiveStep("configure")}
        />
        <div ref={configureRef} tabIndex={-1} className="scroll-mt-28 outline-none">
          <ReapClippingConfigurator
            sourceLabel={sourceLabel}
            sourceThumbnailUrl={sourceThumbnailUrl}
            sourceMetaLabel={sourceMetaLabel}
            initialConfig={initialConfig}
            onStartClipping={createAndStartClipping}
          />
        </div>
        <button
          type="button"
          disabled={state === "submitting"}
          onClick={() => {
            setPreparedSource(null);
            setActiveStep("source");
            setState("idle");
            setMessage("");
          }}
          suppressHydrationWarning
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] hover:text-[#dffe00] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Change source
        </button>
        {message ? (
          <p className={`rounded-lg border px-4 py-3 text-sm font-bold ${state === "error" ? "border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] text-[#ffb4ab]" : "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]"}`}>
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <StepIndicator
        activeStep={activeStep}
        canConfigure={false}
        onSourceClick={() => setActiveStep("source")}
        onConfigureClick={() => undefined}
      />
      <form onSubmit={handleSubmit} className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
        <div className="grid gap-5">
          <input type="hidden" name="sourceType" value="file" />

          <label className="grid gap-2">
            <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Video URL</span>
            <input
              name="sourceUrl"
              type="url"
              disabled={state === "submitting"}
              placeholder="https://example.com/video.mp4"
              suppressHydrationWarning
              className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)] disabled:cursor-wait disabled:opacity-70"
            />
            <span className="text-xs font-bold text-[#909378]">Use a URL, or choose a file below. If both are set, the file upload wins.</span>
          </label>

          <label className="grid gap-2">
            <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Source file</span>
            <input
              name="sourceFile"
              type="file"
              disabled={state === "submitting"}
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              suppressHydrationWarning
              className="w-full rounded-lg border border-dashed border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#d3f000] file:px-4 file:py-2 file:font-[family-name:var(--font-mono)] file:text-xs file:font-bold file:uppercase file:tracking-[0.12em] file:text-[#2c3400] placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)] disabled:cursor-wait disabled:opacity-70"
            />
            <span className="text-xs font-bold text-[#909378]">Allowed formats: MP4, MOV, WEBM.</span>
          </label>

          <label className="grid gap-2">
            <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Working title</span>
            <input
              name="title"
              type="text"
              disabled={state === "submitting"}
              placeholder="Podcast episode 17, launch webinar, customer interview..."
              suppressHydrationWarning
              className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)] disabled:cursor-wait disabled:opacity-70"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Target platform</span>
            <select
              name="platform"
              defaultValue="tiktok"
              disabled={state === "submitting"}
              suppressHydrationWarning
              className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)] disabled:cursor-wait disabled:opacity-70"
            >
              <option value="tiktok">TikTok only for MVP</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={state === "submitting"}
            suppressHydrationWarning
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#d3f000] px-5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {state === "submitting" ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2c3400]/30 border-t-[#2c3400]" />
                Preparing preview...
              </>
            ) : (
              "Create clipping task"
            )}
          </button>

          {message ? (
            <p className={`rounded-lg border px-4 py-3 text-sm font-bold ${state === "error" ? "border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] text-[#ffb4ab]" : "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]"}`}>
              {message}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
