import type { CSSProperties } from "react";
import { getCaptionPreviewTheme } from "@/lib/reap/caption-preset-preview";

type CaptionPresetPreviewProps = {
  presetId: string;
  presetName: string;
  disabled?: boolean;
};

const UPPERCASE_WORDS = ["ONE", "SMALL", "STEP", "FOR MAN"];
const SENTENCE_WORDS = ["One", "small", "step", "for man"];

export function CaptionPresetPreview({
  presetId,
  presetName,
  disabled = false,
}: CaptionPresetPreviewProps) {
  if (disabled) {
    return (
      <div className="caption-preset-preview caption-preset-preview--disabled" aria-hidden="true">
        <span className="caption-preset-preview__cc">CC</span>
        <span className="caption-preset-preview__disabled-label">Off</span>
      </div>
    );
  }

  const theme = getCaptionPreviewTheme(presetId, presetName);
  const words = theme.sentenceCase ? SENTENCE_WORDS : UPPERCASE_WORDS;
  const style = {
    "--caption-primary": theme.primary,
    "--caption-accent": theme.accent,
    "--caption-surface": theme.surface,
  } as CSSProperties;

  return (
    <div
      className={`caption-preset-preview caption-preset-preview--${theme.variant}${
        theme.italic ? " caption-preset-preview--italic" : ""
      }`}
      style={style}
      aria-hidden="true"
    >
      <span className="caption-preset-preview__copy">
        {words.map((word, index) => (
          <span
            key={`${word}-${index}`}
            className={
              index === theme.accentWord
                ? "caption-preset-preview__word caption-preset-preview__word--accent"
                : "caption-preset-preview__word"
            }
          >
            {word}
          </span>
        ))}
      </span>
      {theme.variant === "audiogram" ? (
        <span className="caption-preset-preview__bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : null}
      {theme.variant === "typewriter" ? (
        <span className="caption-preset-preview__caret" />
      ) : null}
    </div>
  );
}
