export type CaptionPreviewVariant =
  | "audiogram"
  | "badge"
  | "clean"
  | "comic"
  | "fullbox"
  | "glitch"
  | "glow"
  | "minimal"
  | "motion"
  | "notes"
  | "outline"
  | "popline"
  | "prism"
  | "serif"
  | "split"
  | "stretch"
  | "ticker"
  | "typewriter"
  | "underline"
  | "wave";

export type CaptionPreviewTheme = {
  variant: CaptionPreviewVariant;
  primary: string;
  accent: string;
  surface: string;
  accentWord: number;
  sentenceCase?: boolean;
  italic?: boolean;
};

// Reap exposes preset IDs but not its Studio thumbnail/font tokens, so the app
// mirrors each system preset with a lightweight CSS preview keyed by the real ID.
const THEMES: Record<string, CaptionPreviewTheme> = {
  system_think_media: theme("clean", "#ffffff", "#ffe23f", "#2d2d2d", 1),
  system_march: theme("split", "#ffffff", "#ff5a4f", "#303030", 2),
  system_pulse: theme("audiogram", "#ffffff", "#52d9ff", "#292b2b", 0),
  system_slide_down: theme("motion", "#ffffff", "#dffe00", "#303030", 2),
  system_punch: theme("badge", "#0b0a09", "#dffe00", "#292b2b", 0),
  system_lemon: theme("comic", "#ffffff", "#f5df24", "#303030", 1, false, true),
  system_surge: theme("wave", "#ffffff", "#3ee6d0", "#303030", 2),
  system_bubblegum: theme("outline", "#ff55d5", "#ffffff", "#303030", 2),
  system_cloud_fall: theme("glow", "#ffffff", "#8ed8ff", "#2d2f32", 3),
  system_tremor: theme("glitch", "#ffffff", "#ff655f", "#303030", 1),
  system_stretchy: theme("stretch", "#ffffff", "#f4d84b", "#303030", 2),
  system_bloom: theme("glow", "#ffffff", "#ff9bdc", "#302d31", 1),
  system_hype: theme("fullbox", "#111111", "#f7e644", "#303030", 0),
  system_blur: theme("glow", "#ffffff", "#a9b8ff", "#292a2d", 0),
  system_ready_audiogram_tech_talk: theme("audiogram", "#ffffff", "#37d4ff", "#20292d", 3),
  system_wiggle: theme("wave", "#ffffff", "#ffde2e", "#303030", 1),
  system_typewriter: theme("typewriter", "#ffffff", "#dffe00", "#292929", 3, true),
  system_wavy: theme("wave", "#ffffff", "#ffcf47", "#303030", 2),
  system_kinetic_typography: theme("motion", "#ffffff", "#dffe00", "#303030", 1),
  system_ticker: theme("ticker", "#ffffff", "#dffe00", "#303030", 0),
  system_squiggly: theme("underline", "#ffffff", "#4ed9ff", "#303030", 2),
  system_glitch_v2: theme("glitch", "#ffffff", "#55f6ff", "#29292c", 1),
  system_glitch: theme("glitch", "#ffffff", "#ff4da8", "#29292c", 2),
  system_striker: theme("split", "#ffffff", "#ffdd31", "#303030", 2),
  system_trophy: theme("serif", "#ffffff", "#f6c34a", "#302b21", 1),
  system_prism: theme("prism", "#ffffff", "#bb75ff", "#2d2d31", 0),
  system_halo: theme("glow", "#ffffff", "#ffe998", "#31302b", 0),
  system_crimson: theme("outline", "#ff4d5d", "#ffffff", "#30292b", 2),
  system_candy: theme("comic", "#ffffff", "#ff75cf", "#312d31", 1),
  system_ready_audiogram_vinyl_vibes: theme("audiogram", "#ffffff", "#ff9a52", "#302a27", 0),
  system_ready_audiogram_daily_cafe: theme("audiogram", "#fff7e5", "#e2a55d", "#302c27", 1),
  system_blue: theme("comic", "#ffffff", "#57d8ff", "#303030", 0, false, true),
  system_deep_diver: theme("fullbox", "#757575", "#f2eff2", "#303030", 2, true),
  system_popline: theme("popline", "#ffffff", "#8d62e9", "#303030", 0, true),
  system_beasty: theme("comic", "#ffffff", "#fff034", "#303030", 1, false, true),
  system_phantom: theme("outline", "#ffffff", "#ffffff", "#303030", 1),
  system_playdate: theme("serif", "#8f8177", "#c6874a", "#303030", 1, true),
  system_galaxy: theme("badge", "#ffffff", "#6f43bd", "#303030", 0),
  system_turban: theme("fullbox", "#ffffff", "#7042cf", "#303030", 2),
  system_flipper: theme("fullbox", "#111111", "#ffdb3d", "#303030", 1),
  system_spell: theme("badge", "#f0e4ff", "#84569e", "#303030", 0),
  system_youshaei: theme("split", "#9a969d", "#50f3bd", "#303030", 0),
  system_pod_p: theme("outline", "#ff4de1", "#ffffff", "#303030", 2),
  system_noah: theme("comic", "#ffffff", "#ffffff", "#303030", 0, false, true),
  system_drive: theme("underline", "#ffffff", "#4381ff", "#303030", 1),
  system_orange: theme("outline", "#9f421d", "#f26d2f", "#303030", 1),
  system_ghost: theme("glow", "#ffffff", "#ffffff", "#303030", 0),
  system_pro_box: theme("badge", "#ffffff", "#ffffff", "#303030", 2, true),
  system_webster: theme("minimal", "#ffffff", "#f04b57", "#303030", 0),
  system_lumina: theme("glow", "#ffffff", "#cae8ff", "#2c3033", 2),
  system_indigo: theme("fullbox", "#ffffff", "#4c50b8", "#303030", 1),
  system_ember: theme("outline", "#ff713c", "#ffb244", "#302b29", 2),
  system_glow: theme("glow", "#ffffff", "#dffe00", "#303030", 1),
  system_impact: theme("outline", "#ffffff", "#ffffff", "#303030", 0),
  system_notes: theme("notes", "#191919", "#fff3ae", "#303030", 1, true),
  system_vintage: theme("serif", "#fff7e7", "#d8b77e", "#302d29", 0, true),
  system_mint: theme("split", "#ffffff", "#74f7bb", "#303030", 1),
  system_one_punch: theme("badge", "#111111", "#fff02d", "#303030", 0),
  system_silka: theme("serif", "#717171", "#7cdc38", "#303030", 0, true, true),
  system_headlines: theme("fullbox", "#111111", "#ffffff", "#303030", 2),
  system_wasabi: theme("comic", "#ffffff", "#a7e843", "#303030", 1),
  system_ember_duo: theme("split", "#ffffff", "#ff7043", "#302b29", 2),
  system_pet: theme("comic", "#ffffff", "#f6de40", "#303030", 3, false, true),
  system_zen: theme("minimal", "#ffffff", "#9ee7cf", "#303030", 1, true),
  system_mozi: theme("split", "#ffffff", "#4de1df", "#303030", 0),
  system_tech_talk: theme("typewriter", "#ffffff", "#47ccff", "#292d30", 2),
  system_yc: theme("minimal", "#ffffff", "#dffe00", "#303030", 3, true),
  system_playfair: theme("serif", "#ffffff", "#e2b96f", "#303030", 1, true),
  system_popping: theme("motion", "#ffffff", "#ff5ecf", "#303030", 0),
};

function theme(
  variant: CaptionPreviewVariant,
  primary: string,
  accent: string,
  surface: string,
  accentWord: number,
  sentenceCase = false,
  italic = false,
): CaptionPreviewTheme {
  return {
    variant,
    primary,
    accent,
    surface,
    accentWord,
    sentenceCase,
    italic,
  };
}

const FALLBACK_VARIANTS: CaptionPreviewVariant[] = [
  "clean",
  "comic",
  "fullbox",
  "glow",
  "outline",
  "serif",
  "split",
  "underline",
  "wave",
];

const FALLBACK_ACCENTS = [
  "#dffe00",
  "#54d8ff",
  "#ff65c8",
  "#ffcb45",
  "#65efb7",
  "#9b7cff",
];

function hashPreset(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getCaptionPreviewTheme(presetId: string, presetName: string) {
  const knownTheme = THEMES[presetId];

  if (knownTheme) {
    return knownTheme;
  }

  const hash = hashPreset(`${presetId}:${presetName}`);

  return theme(
    FALLBACK_VARIANTS[hash % FALLBACK_VARIANTS.length],
    "#ffffff",
    FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length],
    "#303030",
    hash % 4,
    hash % 3 === 0,
    hash % 4 === 0,
  );
}
