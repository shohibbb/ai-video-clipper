"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ReapClippingConfigurator } from "@/components/reap-clipping-configurator";
import type { ReapClippingConfig } from "@/lib/reap/clipping-config";
import { formatStorageUploadError } from "@/lib/storage/upload-errors";

type SubmitState = "idle" | "submitting" | "success" | "error";
type PreparedSource =
  | {
      type: "url";
      sourceUrl: string;
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

export function VideoSubmitForm({ initialConfig }: { initialConfig: ReapClippingConfig }) {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string>("");
  const [preparedSource, setPreparedSource] = useState<PreparedSource | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("idle");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const sourceFile = formData.get("sourceFile");
    const hasSourceFile = sourceFile instanceof File && sourceFile.size > 0;
    const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const platform = String(formData.get("platform") ?? "tiktok");

    if (!hasSourceFile && !sourceUrl) {
      setState("error");
      setMessage("Add a video URL or choose an MP4, MOV, or WEBM file.");
      return;
    }

    if (hasSourceFile) {
      setPreparedSource({
        type: "file",
        sourceFile,
        title,
        platform,
      });
      setMessage("Source selected. Configure Reap options before queueing.");
      return;
    }

    setPreparedSource({
      type: "url",
      sourceUrl,
      title,
      platform,
    });
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

    return (
      <div className="grid gap-5">
        <ReapClippingConfigurator
          sourceLabel={sourceLabel}
          initialConfig={initialConfig}
          onStartClipping={createAndStartClipping}
        />
        <button
          type="button"
          disabled={state === "submitting"}
          onClick={() => {
            setPreparedSource(null);
            setState("idle");
            setMessage("");
          }}
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
    <form onSubmit={handleSubmit} className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
      <div className="grid gap-5">
        <input type="hidden" name="sourceType" value="file" />

        <label className="grid gap-2">
          <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Video URL</span>
          <input
            name="sourceUrl"
            type="url"
            placeholder="https://example.com/video.mp4"
            className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          />
          <span className="text-xs font-bold text-[#909378]">Use a URL, or choose a file below. If both are set, the file upload wins.</span>
        </label>

        <label className="grid gap-2">
          <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Source file</span>
          <input
            name="sourceFile"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            className="w-full rounded-lg border border-dashed border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-[#d3f000] file:px-4 file:py-2 file:font-[family-name:var(--font-mono)] file:text-xs file:font-bold file:uppercase file:tracking-[0.12em] file:text-[#2c3400] placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          />
          <span className="text-xs font-bold text-[#909378]">Allowed formats: MP4, MOV, WEBM.</span>
        </label>

        <label className="grid gap-2">
          <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Working title</span>
          <input
            name="title"
            type="text"
            placeholder="Podcast episode 17, launch webinar, customer interview..."
            className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          />
        </label>

        <label className="grid gap-2">
          <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Target platform</span>
          <select
            name="platform"
            defaultValue="tiktok"
            className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          >
            <option value="tiktok">TikTok only for MVP</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#d3f000] px-5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {state === "submitting" ? "Preparing..." : "Create clipping task"}
        </button>

        {message ? (
          <p className={`rounded-lg border px-4 py-3 text-sm font-bold ${state === "error" ? "border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] text-[#ffb4ab]" : "border-[#39ff14] bg-[rgba(57,255,20,0.10)] text-[#39ff14]"}`}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
