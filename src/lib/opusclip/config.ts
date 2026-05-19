import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type OpusClipConfig = {
  baseUrl: string;
  appUrl: string;
  loginUrl: string;
  usePersistentContext: boolean;
  userDataDir: string;
  storageStatePath: string;
  artifactsDir: string;
  downloadsDir: string;
  headless: boolean;
  selectorTimeoutMs: number;
  submitTimeoutMs: number;
  processingTimeoutMs: number;
  processingPollMs: number;
  downloadTimeoutMs: number;
};

function getNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getOpusClipConfig(): OpusClipConfig {
  const baseUrl = process.env.OPUSCLIP_BASE_URL ?? "https://clip.opus.pro";

  return {
    baseUrl,
    appUrl: process.env.OPUSCLIP_APP_URL ?? `${baseUrl}/dashboard`,
    loginUrl: process.env.OPUSCLIP_LOGIN_URL ?? `${baseUrl}/dashboard`,
    usePersistentContext: process.env.OPUSCLIP_USE_PERSISTENT_CONTEXT === "true",
    userDataDir: resolve(process.env.OPUSCLIP_USER_DATA_DIR ?? "./playwright/.profiles/opusclip"),
    storageStatePath: resolve(process.env.OPUSCLIP_STORAGE_STATE_PATH ?? "./playwright/.auth/opusclip.json"),
    artifactsDir: resolve(process.env.OPUSCLIP_ARTIFACTS_DIR ?? "./artifacts/opusclip"),
    downloadsDir: resolve(process.env.OPUSCLIP_DOWNLOADS_DIR ?? "./downloads/opusclip"),
    headless: process.env.OPUSCLIP_HEADLESS !== "false",
    selectorTimeoutMs: getNumberEnv("OPUSCLIP_SELECTOR_TIMEOUT_MS", 5_000),
    submitTimeoutMs: getNumberEnv("OPUSCLIP_SUBMIT_TIMEOUT_MS", 90_000),
    processingTimeoutMs: getNumberEnv("OPUSCLIP_PROCESSING_TIMEOUT_MS", 45 * 60 * 1000),
    processingPollMs: getNumberEnv("OPUSCLIP_PROCESSING_POLL_MS", 15_000),
    downloadTimeoutMs: getNumberEnv("OPUSCLIP_DOWNLOAD_TIMEOUT_MS", 120_000),
  };
}

export function hasSavedOpusClipSession(config = getOpusClipConfig()) {
  if (config.usePersistentContext) {
    return existsSync(config.userDataDir);
  }

  return existsSync(config.storageStatePath);
}
