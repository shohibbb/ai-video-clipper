"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type ClipMetadata = {
  id: string;
  title: string | null;
  caption: string | null;
  hashtags: string[];
};

function hashtagsToInput(hashtags: string[]) {
  return hashtags.join(", ");
}

function inputToHashtags(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("#") ? item : `#${item}`));
}

export function ClipMetadataEditor({ clip }: { clip: ClipMetadata }) {
  const router = useRouter();
  const [metadata, setMetadata] = useState({
    title: clip.title ?? "",
    caption: clip.caption ?? "",
    hashtags: hashtagsToInput(clip.hashtags),
  });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"save" | "generate" | null>(null);

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAction("save");
    setError("");
    setMessage("");

    const response = await fetch(`/api/clips/${clip.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: metadata.title,
        caption: metadata.caption,
        hashtags: inputToHashtags(metadata.hashtags),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setAction(null);
      setError(result.error ?? "Unable to save clip metadata.");
      return;
    }

    setMetadata({
      title: result.title ?? "",
      caption: result.caption ?? "",
      hashtags: hashtagsToInput(result.hashtags ?? []),
    });
    setMessage("Metadata saved.");
    setAction(null);
    refresh();
  }

  async function generateCaption() {
    setAction("generate");
    setError("");
    setMessage("");

    const response = await fetch(`/api/clips/${clip.id}/generate-caption`, {
      method: "POST",
    });

    const result = await response.json();

    if (!response.ok) {
      setAction(null);
      setError(result.error ?? "Unable to generate placeholder caption.");
      return;
    }

    setMetadata({
      title: result.title ?? "",
      caption: result.caption ?? "",
      hashtags: hashtagsToInput(result.hashtags ?? []),
    });
    setMessage(result.message ?? "Placeholder caption generated.");
    setAction(null);
    refresh();
  }

  const busy = Boolean(action) || isPending;

  return (
    <form onSubmit={saveMetadata} className="grid gap-4">
      <label className="grid gap-2">
        <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Title</span>
        <input
          value={metadata.title}
          onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))}
          className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          placeholder="A sharp title for this short"
        />
      </label>

      <label className="grid gap-2">
        <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Caption</span>
        <textarea
          value={metadata.caption}
          onChange={(event) => setMetadata((current) => ({ ...current, caption: event.target.value }))}
          rows={5}
          className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          placeholder="Hook, takeaway, call to action..."
        />
      </label>

      <label className="grid gap-2">
        <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#39ff14]">Hashtags</span>
        <input
          value={metadata.hashtags}
          onChange={(event) => setMetadata((current) => ({ ...current, hashtags: event.target.value }))}
          className="w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          placeholder="#shorts, #ai, #creator"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#d3f000] px-5 py-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {action === "save" ? "Saving..." : "Save metadata"}
        </button>
        <button
          type="button"
          onClick={generateCaption}
          disabled={busy}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-4 py-2.5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] hover:text-[#dffe00] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {action === "generate" ? "Generating..." : "Generate caption"}
        </button>
      </div>

      {message ? <p className="rounded-lg border border-[#39ff14] bg-[rgba(57,255,20,0.10)] px-4 py-3 text-sm font-bold text-[#39ff14]">{message}</p> : null}
      {error ? <p className="rounded-lg border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-4 py-3 text-sm font-bold text-[#ffb4ab]">{error}</p> : null}
    </form>
  );
}
