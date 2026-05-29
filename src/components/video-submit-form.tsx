"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SubmitState = "idle" | "submitting" | "success" | "error";

export function VideoSubmitForm() {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const sourceFile = formData.get("sourceFile");
    const hasSourceFile = sourceFile instanceof File && sourceFile.size > 0;
    const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();

    if (!hasSourceFile && !sourceUrl) {
      setState("error");
      setMessage("Add a video URL or choose an MP4, MOV, or WEBM file.");
      return;
    }

    const response = hasSourceFile
      ? await fetch("/api/videos", {
          method: "POST",
          body: formData,
        })
      : await fetch("/api/videos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceType: "url",
            sourceUrl,
            title: String(formData.get("title") ?? ""),
            platformTargets: ["tiktok"],
          }),
        });

    const result = await response.json();

    if (!response.ok) {
      setState("error");
      setMessage([result.error, result.details].filter(Boolean).join(" ") || "Unable to create video task.");
      return;
    }

    setState("success");
    setMessage("Video task created. Redirecting to detail...");
    router.push(`/videos/${result.videoId}`);
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
          {state === "submitting" ? "Creating task..." : "Create clipping task"}
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
