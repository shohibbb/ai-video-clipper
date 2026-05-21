export type ReapConfig = {
  apiKey: string;
  baseUrl: string;
  defaultGenre: string;
  defaultOrientation: string;
  defaultResolution: number;
  defaultReframe: boolean;
  defaultCaptionsPreset: string | null;
  defaultEnableEmojis: boolean;
  defaultEnableHighlights: boolean;
  defaultLanguage: string | null;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  maxSourceVideoUploadMb: number;
};

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getReapConfig(): ReapConfig {
  return {
    apiKey: process.env.REAP_API_KEY ?? "",
    baseUrl: process.env.REAP_BASE_URL ?? "https://public.reap.video/api/v1/automation",
    defaultGenre: process.env.REAP_DEFAULT_GENRE ?? "talking",
    defaultOrientation: process.env.REAP_DEFAULT_ORIENTATION ?? "portrait",
    defaultResolution: getNumberEnv("REAP_DEFAULT_RESOLUTION", 1080),
    defaultReframe: process.env.REAP_DEFAULT_REFRAME !== "false",
    defaultCaptionsPreset: process.env.REAP_DEFAULT_CAPTIONS_PRESET || null,
    defaultEnableEmojis: process.env.REAP_DEFAULT_ENABLE_EMOJIS !== "false",
    defaultEnableHighlights: process.env.REAP_DEFAULT_ENABLE_HIGHLIGHTS !== "false",
    defaultLanguage: process.env.REAP_DEFAULT_LANGUAGE || null,
    pollIntervalMs: getNumberEnv("REAP_POLL_INTERVAL_MS", 10_000),
    pollTimeoutMs: getNumberEnv("REAP_POLL_TIMEOUT_MS", 900_000),
    maxSourceVideoUploadMb: getNumberEnv("REAP_MAX_SOURCE_VIDEO_UPLOAD_MB", 500),
  };
}

export function requireReapApiKey(): string {
  const config = getReapConfig();
  if (!config.apiKey) {
    throw new Error("REAP_API_KEY is required. Set it in your .env file.");
  }
  return config.apiKey;
}