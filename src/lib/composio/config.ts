export type ComposioTikTokConfig = {
  apiKey: string | null;
  connectedAccountId: string | null;
  uploadToolSlug: string;
  userId: string | null;
  toolkitVersion: string | null;
  publish: boolean;
  privacyLevel: string | null;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  signedUrlExpiresInSeconds: number;
  extraArguments: Record<string, unknown>;
};

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function readBooleanEnv(name: string, defaultValue: boolean) {
  const value = readOptionalEnv(name);

  if (!value) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readNumberEnv(name: string, defaultValue: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function readJsonEnv(name: string) {
  const value = readOptionalEnv(name);

  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error(`${name} must be valid JSON when provided.`);
  }
}

export function getComposioTikTokConfig(): ComposioTikTokConfig {
  return {
    apiKey: readOptionalEnv("COMPOSIO_API_KEY"),
    connectedAccountId: readOptionalEnv("COMPOSIO_TIKTOK_CONNECTED_ACCOUNT_ID"),
    uploadToolSlug: readOptionalEnv("COMPOSIO_TIKTOK_UPLOAD_ACTION") ?? "TIKTOK_UPLOAD_VIDEO",
    userId: readOptionalEnv("COMPOSIO_TIKTOK_USER_ID"),
    toolkitVersion: readOptionalEnv("COMPOSIO_TOOLKIT_VERSION_TIKTOK") ?? readOptionalEnv("COMPOSIO_TIKTOK_TOOLKIT_VERSION"),
    publish: readBooleanEnv("COMPOSIO_TIKTOK_PUBLISH", false),
    privacyLevel: readOptionalEnv("COMPOSIO_TIKTOK_PRIVACY_LEVEL") ?? "SELF_ONLY",
    disableComment: readBooleanEnv("COMPOSIO_TIKTOK_DISABLE_COMMENT", false),
    disableDuet: readBooleanEnv("COMPOSIO_TIKTOK_DISABLE_DUET", false),
    disableStitch: readBooleanEnv("COMPOSIO_TIKTOK_DISABLE_STITCH", false),
    signedUrlExpiresInSeconds: readNumberEnv("COMPOSIO_TIKTOK_SIGNED_URL_EXPIRES_SECONDS", 60 * 60),
    extraArguments: readJsonEnv("COMPOSIO_TIKTOK_EXTRA_ARGUMENTS"),
  };
}

export function requireComposioApiKey(config = getComposioTikTokConfig()) {
  if (!config.apiKey) {
    throw new Error("COMPOSIO_API_KEY is missing. Add it to the worker environment before running TikTok uploads.");
  }

  return config.apiKey;
}
