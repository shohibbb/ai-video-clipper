"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { CaptionPresetPreview } from "@/components/caption-preset-preview";
import type { ReapClippingConfig } from "@/lib/reap/clipping-config";

type ReapPreset = {
  id: string;
  name: string;
  source: "system" | "user";
  preferences: Record<string, unknown>;
};

type PresetsResponse = {
  data?: ReapPreset[];
  error?: string;
};

type ConfiguratorProps = {
  videoId?: string;
  sourceLabel: string;
  sourceThumbnailUrl?: string | null;
  sourceMetaLabel?: string | null;
  initialConfig: ReapClippingConfig;
  onStartClipping?: (config: ReapClippingConfig) => Promise<
    | {
        ok: true;
      }
    | {
        ok: false;
        error: string;
      }
  >;
};

const genreOptions = [
  { value: "talking", label: "Talking" },
  { value: "screenshare", label: "Presentation" },
  { value: "gaming", label: "Gaming" },
] as const;

const durationOptions = [
  { label: "<30s", value: [0, 30] },
  { label: "30s-60s", value: [30, 60] },
  { label: "60s-90s", value: [60, 90] },
  { label: "90s-3min", value: [90, 180] },
] as const;

const languageOptions = [
  { value: "", label: "Auto detect" },
  { value: "id", label: "Indonesian" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "ja", label: "Japanese" },
];

const translationOptions = [
  { value: "", label: "None" },
  { value: "id", label: "Indonesian" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "ja", label: "Japanese" },
];

function sameRange(left: number[], right: readonly number[]) {
  return left[0] === right[0] && left[1] === right[1];
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      aria-pressed={checked}
      disabled={disabled}
      className={`inline-flex h-7 w-12 items-center rounded-full border p-1 transition ${
        checked
          ? "border-[#18a7ff] bg-[#18a7ff]"
          : "border-[rgba(223,254,0,0.12)] bg-[rgba(144,147,120,0.18)]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className={`h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function PresetCard({
  preset,
  selected,
  onSelect,
  compact = false,
  radio = false,
}: {
  preset: ReapPreset;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
  radio?: boolean;
}) {
  const captionsDisabled = preset.id === "__none";

  return (
    <button
      type="button"
      onClick={onSelect}
      role={radio ? "radio" : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
      aria-label={`${preset.name}${selected ? ", selected" : ""}`}
      className={`group relative grid min-w-0 overflow-hidden rounded-lg border text-left transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dffe00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161514] ${
        selected
          ? "border-[#18a7ff] bg-[rgba(24,167,255,0.08)] shadow-[0_0_0_1px_rgba(24,167,255,0.28)]"
          : "border-[rgba(255,255,255,0.12)] bg-[#202120]"
      }`}
    >
      <div className={compact ? "h-24" : "h-[7.25rem]"}>
        <CaptionPresetPreview
          presetId={preset.id}
          presetName={preset.name}
          disabled={captionsDisabled}
        />
      </div>
      <div className="flex min-h-12 items-center justify-between gap-3 border-t border-white/5 bg-[#171817] px-3 py-2.5">
        <span className="truncate text-sm font-bold text-white">{preset.name}</span>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
            selected
              ? "border-[#18a7ff] bg-[#18a7ff] shadow-[0_0_0_3px_rgba(24,167,255,0.15)]"
              : "border-[#686a65] bg-transparent group-hover:border-[#dffe00]"
          }`}
          aria-hidden="true"
        >
        </span>
      </div>
    </button>
  );
}

export function ReapClippingConfigurator({
  videoId,
  sourceLabel,
  sourceThumbnailUrl,
  sourceMetaLabel,
  initialConfig,
  onStartClipping,
}: ConfiguratorProps) {
  const router = useRouter();
  const [config, setConfig] = useState<ReapClippingConfig>(initialConfig);
  const [presets, setPresets] = useState<ReapPreset[]>([]);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const [modalPresetId, setModalPresetId] = useState<string | null>(
    initialConfig.captionsPreset,
  );
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetError, setPresetError] = useState("");
  const [topicsInput, setTopicsInput] = useState(initialConfig.topics.join(", "));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPresets() {
      try {
        const response = await fetch("/api/reap/presets");
        const result = (await response.json().catch(() => ({}))) as PresetsResponse;

        if (cancelled) {
          return;
        }

        if (!response.ok || !result.data) {
          setPresetError(result.error || "Unable to load Reap presets.");
          setPresets([]);
          return;
        }

        setPresets(result.data);
      } catch {
        if (!cancelled) {
          setPresetError("Unable to load Reap presets.");
          setPresets([]);
        }
      } finally {
        if (!cancelled) {
          setPresetsLoading(false);
        }
      }
    }

    void loadPresets();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showAllPresets) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowAllPresets(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [showAllPresets]);

  const allPresetOptions = useMemo(() => {
    const noCaptionsPreset: ReapPreset = {
      id: "__none",
      name: "No captions",
      source: "system",
      preferences: {},
    };

    const fallbackPreset =
      config.captionsPreset && !presets.some((preset) => preset.id === config.captionsPreset)
        ? [{ id: config.captionsPreset, name: config.captionsPreset, source: "system" as const, preferences: {} }]
        : [];

    return [noCaptionsPreset, ...fallbackPreset, ...presets];
  }, [config.captionsPreset, presets]);

  const visiblePresets = useMemo(() => {
    const noCaptions = allPresetOptions[0];
    const selected = allPresetOptions.find(
      (preset) => preset.id === config.captionsPreset,
    );
    const remaining = allPresetOptions.filter(
      (preset) =>
        preset.id !== "__none" &&
        preset.id !== selected?.id,
    );

    return selected
      ? [selected, noCaptions, ...remaining].slice(0, 5)
      : [noCaptions, ...remaining].slice(0, 5);
  }, [allPresetOptions, config.captionsPreset]);

  function updateConfig(patch: Partial<ReapClippingConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function selectPreset(presetId: string) {
    updateConfig({
      captionsPreset: presetId === "__none" ? null : presetId,
    });
  }

  function toggleDuration(range: readonly number[]) {
    setConfig((current) => {
      const exists = current.clipDurations.some((item) => sameRange(item, range));
      const nextDurations = exists
        ? current.clipDurations.filter((item) => !sameRange(item, range))
        : [...current.clipDurations, [range[0], range[1]] as [number, number]];

      return {
        ...current,
        clipDurations: nextDurations.length ? nextDurations : [[30, 60]],
      };
    });
  }

  async function startClipping() {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    const clippingConfig = {
      ...config,
      topics: topicsInput
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    };

    if (onStartClipping) {
      const result = await onStartClipping(clippingConfig);

      setIsSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Clipping queued. Redirecting...");
      return;
    }

    if (!videoId) {
      setIsSubmitting(false);
      setError("Video ID is required before clipping can start.");
      return;
    }

    const response = await fetch(`/api/videos/${videoId}/start-clipping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clippingConfig),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setError(result.error || "Unable to start clipping.");
      return;
    }

    setMessage("Clipping queued. Redirecting...");
    startTransition(() => {
      router.refresh();
    });
  }

  const busy = isSubmitting || isPending;
  const selectedModalPreset =
    allPresetOptions.find((preset) =>
      preset.id === "__none"
        ? modalPresetId === null
        : modalPresetId === preset.id,
    ) ?? allPresetOptions[0];

  function openPresetModal() {
    setModalPresetId(config.captionsPreset);
    setShowAllPresets(true);
  }

  function applyModalPreset() {
    selectPreset(selectedModalPreset.id);
    setShowAllPresets(false);
  }

  return (
    <section className="rounded-xl border border-[rgba(223,254,0,0.15)] bg-[rgba(22,21,20,0.84)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.40)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 rounded-xl border border-[rgba(223,254,0,0.12)] bg-[rgba(30,32,32,0.70)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid min-w-0 gap-4 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-[rgba(223,254,0,0.16)] bg-[#161514]">
            {sourceThumbnailUrl ? (
              <img
                src={sourceThumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="grid h-full place-items-center px-3 text-center font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[#909378]">
                Source
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#dffe00]">
              Configure source
            </p>
            <h2 className="mt-2 line-clamp-2 font-[family-name:var(--font-display)] text-2xl font-black tracking-[-0.04em] text-white">
              {sourceLabel}
            </h2>
            {sourceMetaLabel ? (
              <p className="mt-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[#909378]">
                {sourceMetaLabel}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={startClipping}
          disabled={busy}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#18a7ff] px-6 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:-translate-y-0.5 hover:bg-[#20d7b7] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {busy ? "Queueing..." : "Get Clips"}
        </button>
      </div>

      <div className="mt-6 grid gap-7">
        <div>
          <p className="mb-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#c6c9ab]">
            Select video genre
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {genreOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateConfig({ genre: option.value })}
                className={`min-h-12 rounded-full border px-4 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.14em] transition hover:-translate-y-0.5 ${
                  config.genre === option.value
                    ? "border-[#16c7d7] bg-[rgba(22,199,215,0.30)] text-white"
                    : "border-[#18a7ff] bg-transparent text-[#18a7ff]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.25em] text-[#c6c9ab]">
              Caption styles
            </p>
            <Toggle checked={config.captionsPreset !== null} onChange={(checked) => updateConfig({ captionsPreset: checked ? initialConfig.captionsPreset || "system_beasty" : null })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {presetsLoading
              ? Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={index}
                    className="h-[10.25rem] animate-pulse rounded-lg border border-white/10 bg-[#242524]"
                  />
                ))
              : visiblePresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    selected={
                      preset.id === "__none"
                        ? config.captionsPreset === null
                        : config.captionsPreset === preset.id
                    }
                    onSelect={() => selectPreset(preset.id)}
                    compact
                  />
                ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openPresetModal}
              disabled={presetsLoading}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.14em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[#dffe00] hover:text-[#dffe00] disabled:cursor-wait disabled:opacity-50 disabled:hover:translate-y-0"
            >
              More styles
            </button>
            {presetError ? <p className="text-sm font-bold text-[#ffb4ab]">{presetError}</p> : null}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgba(223,254,0,0.12)] bg-[rgba(30,32,32,0.70)] p-4">
            <div>
              <p className="font-black text-white">Auto Text Hooks <span className="ml-2 rounded bg-[#444] px-2 py-0.5 text-[10px] text-[#c6c9ab]">BETA</span></p>
              <p className="mt-1 text-sm leading-6 text-[#c6c9ab]">Placeholder only for now; Reap create-clips payload is not wired for this option.</p>
            </div>
            <Toggle checked={false} onChange={() => undefined} disabled />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgba(223,254,0,0.12)] bg-[rgba(30,32,32,0.70)] p-4">
            <div>
              <p className="font-black text-white">Face tracking</p>
              <p className="mt-1 text-sm leading-6 text-[#c6c9ab]">Keep faces centered by reframing clips for the selected orientation.</p>
            </div>
            <Toggle checked={config.reframeClips} onChange={(checked) => updateConfig({ reframeClips: checked })} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Language" value={config.language ?? ""} onChange={(value) => updateConfig({ language: value || null })} options={languageOptions} />
          <SelectField label="Translate to" value={config.translationLanguage ?? ""} onChange={(value) => updateConfig({ translationLanguage: value || null })} options={translationOptions} />
          <SelectField
            label="Script"
            value={config.transcriptionScript}
            onChange={(value) => updateConfig({ transcriptionScript: value as ReapClippingConfig["transcriptionScript"] })}
            options={[
              { value: "native", label: "Native" },
              { value: "roman", label: "Roman" },
            ]}
          />
          <div className="hidden md:block" />
          <SelectField
            label="Orientation"
            value={config.exportOrientation}
            onChange={(value) => updateConfig({ exportOrientation: value as ReapClippingConfig["exportOrientation"] })}
            options={[
              { value: "portrait", label: "Portrait (9:16)" },
              { value: "landscape", label: "Landscape (16:9)" },
              { value: "square", label: "Square (1:1)" },
            ]}
          />
          <SelectField
            label="Resolution"
            value={String(config.exportResolution)}
            onChange={(value) => updateConfig({ exportResolution: Number(value) as ReapClippingConfig["exportResolution"] })}
            options={[
              { value: "720", label: "720" },
              // { value: "1080", label: "1080" },
              // { value: "1440", label: "1440" },
              // { value: "2160", label: "2160" },
            ]}
          />
        </div>

        <div className="rounded-xl border border-[rgba(223,254,0,0.12)] bg-[rgba(30,32,32,0.70)] p-4">
          <p className="font-black text-white">Processing Time Frame</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <NumberField label="Start seconds" value={config.selectedStart ?? ""} onChange={(value) => updateConfig({ selectedStart: value === "" ? null : Number(value) })} />
            <NumberField label="End seconds" value={config.selectedEnd ?? ""} onChange={(value) => updateConfig({ selectedEnd: value === "" ? null : Number(value) })} />
          </div>
          <p className="mt-5 font-black text-white">Auto Clip Length</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            {durationOptions.map((option) => {
              const selected = config.clipDurations.some((item) => sameRange(item, option.value));
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => toggleDuration(option.value)}
                  className={`min-h-11 rounded-full border px-4 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.10em] transition hover:-translate-y-0.5 ${
                    selected
                      ? "border-[#18a7ff] bg-[rgba(24,167,255,0.12)] text-[#18a7ff]"
                      : "border-[rgba(223,254,0,0.14)] bg-[#161514] text-[#c6c9ab]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="grid gap-2 rounded-xl border border-[rgba(223,254,0,0.12)] bg-[rgba(30,32,32,0.70)] p-4">
          <span className="font-black text-white">Clip Topics (optional)</span>
          <span className="text-sm text-[#c6c9ab]">Add keywords to guide what AI should clip, separated by commas.</span>
          <input
            value={topicsInput}
            onChange={(event) => setTopicsInput(event.target.value)}
            placeholder="product launch, customer testimonials"
            className="mt-2 w-full rounded-full border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 py-3.5 text-[#e2e2e1] outline-none transition placeholder:text-[#909378] focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
          />
        </label>

        {error ? <p className="rounded-lg border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-4 py-3 text-sm font-bold text-[#ffb4ab]">{error}</p> : null}
        {message ? <p className="rounded-lg border border-[#39ff14] bg-[rgba(57,255,20,0.10)] px-4 py-3 text-sm font-bold text-[#39ff14]">{message}</p> : null}
      </div>

      {showAllPresets && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) {
                  setShowAllPresets(false);
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="caption-style-dialog-title"
                className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-white/15 bg-[#161716] shadow-[0_28px_90px_rgba(0,0,0,0.68)]"
              >
                <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
                  <h3
                    id="caption-style-dialog-title"
                    className="font-[family-name:var(--font-display)] text-xl font-black text-white sm:text-2xl"
                  >
                    Caption styles
                  </h3>
                  <button
                    type="button"
                    autoFocus
                    aria-label="Close caption styles"
                    onClick={() => setShowAllPresets(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-xl text-[#c6c9ab] transition hover:border-[#dffe00] hover:text-[#dffe00]"
                  >
                    x
                  </button>
                </div>
                <div className="mx-5 mt-4 border-b border-white/15 sm:mx-6">
                  <div className="w-32 border-b border-white pb-3 text-sm font-bold text-white">
                    All styles
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                  <div
                    role="radiogroup"
                    aria-label="Caption style"
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {allPresetOptions.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        selected={
                          preset.id === "__none"
                            ? modalPresetId === null
                            : modalPresetId === preset.id
                        }
                        radio
                        onSelect={() =>
                          setModalPresetId(preset.id === "__none" ? null : preset.id)
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-t border-white/10 bg-[#171817] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="min-w-0 truncate text-sm text-[#aeb19a]">
                    Selected:{" "}
                    <span className="font-bold text-white">{selectedModalPreset.name}</span>
                  </p>
                  <button
                    type="button"
                    onClick={applyModalPreset}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-6 text-sm font-bold text-[#111] transition hover:bg-[#dffe00]"
                  >
                    Select Style
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-2">
      <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.22em] text-[#c6c9ab]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 text-[#e2e2e1] outline-none transition focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.22em] text-[#c6c9ab]">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[#161514] px-4 text-[#e2e2e1] outline-none transition focus:border-[#dffe00] focus:shadow-[0_0_0_4px_rgba(223,254,0,0.10)]"
      />
    </label>
  );
}
