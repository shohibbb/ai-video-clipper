import { estimateRedisCommandBudget } from "@/lib/queue/worker-options";

export type ProductionCheckSeverity = "ok" | "warning" | "error";

export type ProductionCheckResult = {
  name: string;
  severity: ProductionCheckSeverity;
  message: string;
};

type Env = Record<string, string | undefined>;

const PLACEHOLDER_VALUES = new Set([
  "",
  "change_me",
  "changeme",
  "placeholder",
  "replace_me",
  "replace_with_secret",
  "your-secret",
  "your_reap_api_key",
]);

function hasValue(value: string | undefined | null) {
  return Boolean(value?.trim());
}

function normalize(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

function hasPlaceholderValue(value: string | undefined | null) {
  return PLACEHOLDER_VALUES.has(normalize(value));
}

function isLocalUrl(value: string) {
  return /(^|\.)localhost($|[:/])|127\.0\.0\.1|0\.0\.0\.0/.test(value);
}

function validateHttpsUrl(value: string | undefined, name: string, results: ProductionCheckResult[]) {
  if (!hasValue(value)) {
    results.push({
      name,
      severity: "error",
      message: `${name} is required for production.`,
    });
    return;
  }

  try {
    const url = new URL(value!);

    if (url.protocol !== "https:") {
      results.push({
        name,
        severity: "error",
        message: `${name} must use HTTPS in production.`,
      });
      return;
    }

    if (isLocalUrl(url.hostname)) {
      results.push({
        name,
        severity: "error",
        message: `${name} must not point to localhost in production.`,
      });
      return;
    }

    results.push({
      name,
      severity: "ok",
      message: `${name} is a production HTTPS URL.`,
    });
  } catch {
    results.push({
      name,
      severity: "error",
      message: `${name} must be a valid URL.`,
    });
  }
}

function validateConnectionUrl(
  value: string | undefined,
  name: string,
  allowedProtocols: string[],
  results: ProductionCheckResult[],
) {
  if (!hasValue(value) || hasPlaceholderValue(value)) {
    results.push({
      name,
      severity: "error",
      message: `${name} is required for production.`,
    });
    return;
  }

  try {
    const url = new URL(value!);

    if (!allowedProtocols.includes(url.protocol)) {
      results.push({
        name,
        severity: "error",
        message: `${name} must use one of these protocols: ${allowedProtocols.join(", ")}.`,
      });
      return;
    }

    if (isLocalUrl(url.hostname)) {
      results.push({
        name,
        severity: "error",
        message: `${name} must not point to localhost in production.`,
      });
      return;
    }

    results.push({
      name,
      severity: "ok",
      message: `${name} is a production connection URL.`,
    });
  } catch {
    results.push({
      name,
      severity: "error",
      message: `${name} must be a valid connection URL.`,
    });
  }
}

function parseConnectionUrl(value: string | undefined) {
  if (!hasValue(value) || hasPlaceholderValue(value)) {
    return null;
  }

  try {
    return new URL(value!);
  } catch {
    return null;
  }
}

function validatePoolInteger(
  url: URL,
  parameter: "connection_limit" | "pool_timeout",
  results: ProductionCheckResult[],
) {
  const value = url.searchParams.get(parameter);
  const parsedValue = Number(value);

  if (!value || !Number.isInteger(parsedValue) || parsedValue <= 0) {
    results.push({
      name: `DATABASE_URL ${parameter}`,
      severity: "error",
      message: `DATABASE_URL must set ${parameter} to a positive integer.`,
    });
    return null;
  }

  return parsedValue;
}

function validateDatabasePool(env: Env, results: ProductionCheckResult[]) {
  const databaseUrl = parseConnectionUrl(env.DATABASE_URL);

  if (databaseUrl) {
    const connectionLimit = validatePoolInteger(databaseUrl, "connection_limit", results);
    const poolTimeout = validatePoolInteger(databaseUrl, "pool_timeout", results);

    if (connectionLimit === 1) {
      results.push({
        name: "DATABASE_URL connection_limit",
        severity: "ok",
        message: "DATABASE_URL limits each process to one Prisma connection.",
      });
    } else if (connectionLimit !== null) {
      results.push({
        name: "DATABASE_URL connection_limit",
        severity: "error",
        message: "DATABASE_URL connection_limit must be 1 for the current 15-client production pool budget.",
      });
    }

    if (poolTimeout !== null) {
      results.push({
        name: "DATABASE_URL pool_timeout",
        severity: "ok",
        message: "DATABASE_URL has a bounded Prisma pool timeout.",
      });
    }

    if (databaseUrl.hostname.endsWith(".pooler.supabase.com")) {
      if (databaseUrl.port === "6543") {
        results.push({
          name: "DATABASE_URL Supabase mode",
          severity: "ok",
          message: "DATABASE_URL uses Supabase transaction mode on port 6543.",
        });
      } else if (!databaseUrl.port || databaseUrl.port === "5432") {
        results.push({
          name: "DATABASE_URL Supabase mode",
          severity: "warning",
          message: "DATABASE_URL uses Supabase session mode; reserve this for long-lived worker processes, not Vercel.",
        });
      } else {
        results.push({
          name: "DATABASE_URL Supabase mode",
          severity: "warning",
          message: "DATABASE_URL uses an unrecognized Supabase pooler port.",
        });
      }
    }
  }

  const directUrl = parseConnectionUrl(env.DIRECT_URL);

  if (
    directUrl?.hostname.endsWith(".pooler.supabase.com")
    && directUrl.port === "6543"
  ) {
    results.push({
      name: "DIRECT_URL Supabase mode",
      severity: "error",
      message: "DIRECT_URL must not use Supabase transaction mode on port 6543; use a direct or session-mode migration URL.",
    });
  } else if (directUrl) {
    results.push({
      name: "DIRECT_URL migration mode",
      severity: "ok",
      message: "DIRECT_URL is suitable for Prisma migration commands.",
    });
  }
}

function requireSecret(env: Env, name: string, results: ProductionCheckResult[], minimumLength = 32) {
  const value = env[name];

  if (!hasValue(value)) {
    results.push({
      name,
      severity: "error",
      message: `${name} is required for production.`,
    });
    return;
  }

  if (hasPlaceholderValue(value) || value!.trim().length < minimumLength) {
    results.push({
      name,
      severity: "error",
      message: `${name} must be a non-placeholder secret with at least ${minimumLength} characters.`,
    });
    return;
  }

  results.push({
    name,
    severity: "ok",
    message: `${name} is configured.`,
  });
}

function requireValue(env: Env, name: string, results: ProductionCheckResult[]) {
  const value = env[name];

  if (!hasValue(value) || hasPlaceholderValue(value)) {
    results.push({
      name,
      severity: "error",
      message: `${name} is required for production.`,
    });
    return;
  }

  results.push({
    name,
    severity: "ok",
    message: `${name} is configured.`,
  });
}

function getProviderPair(env: Env, idName: string, secretName: string, fallbackIdName: string, fallbackSecretName: string) {
  const id = env[idName] || env[fallbackIdName];
  const secret = env[secretName] || env[fallbackSecretName];

  return {
    configured: hasValue(id) && hasValue(secret),
    partial: hasValue(id) !== hasValue(secret),
  };
}

function validatePositiveInteger(env: Env, name: string, results: ProductionCheckResult[]) {
  const value = env[name];

  if (!hasValue(value)) {
    return;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    results.push({
      name,
      severity: "error",
      message: `${name} must be a positive integer.`,
    });
  }
}

function validateProductionRateLimit(env: Env, results: ProductionCheckResult[]) {
  const maxRequests = Number(env.REAP_RATE_LIMIT_MAX_REQUESTS ?? "10");
  const windowMs = Number(env.REAP_RATE_LIMIT_WINDOW_MS ?? "60000");

  if (!Number.isFinite(maxRequests) || maxRequests <= 0 || maxRequests > 10) {
    results.push({
      name: "REAP_RATE_LIMIT_MAX_REQUESTS",
      severity: "error",
      message: "REAP_RATE_LIMIT_MAX_REQUESTS must be between 1 and 10 to respect Reap's documented limit.",
    });
  } else {
    results.push({
      name: "REAP_RATE_LIMIT_MAX_REQUESTS",
      severity: "ok",
      message: "Reap request cap is within the documented 10 req/min limit.",
    });
  }

  if (!Number.isFinite(windowMs) || windowMs < 60_000) {
    results.push({
      name: "REAP_RATE_LIMIT_WINDOW_MS",
      severity: "error",
      message: "REAP_RATE_LIMIT_WINDOW_MS must be at least 60000 in production.",
    });
  } else {
    results.push({
      name: "REAP_RATE_LIMIT_WINDOW_MS",
      severity: "ok",
      message: "Reap rate limit window is production-safe.",
    });
  }
}

function validatePollingFallback(env: Env, results: ProductionCheckResult[]) {
  const initialDelayMs = Number(env.REAP_POLLING_INITIAL_DELAY_MS ?? "900000");
  const intervalMs = Number(env.REAP_POLL_INTERVAL_MS ?? "300000");
  const timeoutMs = Number(env.REAP_POLL_TIMEOUT_MS ?? "7200000");

  if (!Number.isFinite(initialDelayMs) || initialDelayMs < 900_000) {
    results.push({
      name: "REAP_POLLING_INITIAL_DELAY_MS",
      severity: "error",
      message: "REAP_POLLING_INITIAL_DELAY_MS must be at least 900000 in the low-command webhook-first profile.",
    });
  }

  if (!Number.isFinite(intervalMs) || intervalMs < 300_000) {
    results.push({
      name: "REAP_POLL_INTERVAL_MS",
      severity: "error",
      message: "REAP_POLL_INTERVAL_MS must be at least 300000 in the low-command webhook-first profile.",
    });
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 7_200_000) {
    results.push({
      name: "REAP_POLL_TIMEOUT_MS",
      severity: "error",
      message: "REAP_POLL_TIMEOUT_MS must be at least 7200000 for the two-hour fallback window.",
    });
  }
}

function validateRedisCommandBudget(env: Env, results: ProductionCheckResult[]) {
  const drainDelaySeconds = Number(env.BULLMQ_DRAIN_DELAY_SECONDS ?? "300");
  const stalledIntervalMs = Number(env.BULLMQ_STALLED_INTERVAL_MS ?? "300000");
  const publishIntervalMs = Number(env.REAP_PUBLISH_STATUS_INTERVAL_MS ?? "120000");
  const publishTimeoutMs = Number(env.REAP_PUBLISH_STATUS_TIMEOUT_MS ?? "7200000");
  const monthlyQuota = Number(env.REDIS_MONTHLY_COMMAND_QUOTA ?? "500000");
  const plannedVideos = Number(env.REDIS_PLANNED_VIDEOS_PER_MONTH ?? "100");
  const plannedPublishes = Number(env.REDIS_PLANNED_PUBLISHES_PER_MONTH ?? "100");
  const reapInitialDelayMs = Number(env.REAP_POLLING_INITIAL_DELAY_MS ?? "900000");
  const reapTimeoutMs = Number(env.REAP_POLL_TIMEOUT_MS ?? "7200000");

  if (!Number.isFinite(drainDelaySeconds) || drainDelaySeconds < 300) {
    results.push({
      name: "BULLMQ_DRAIN_DELAY_SECONDS",
      severity: "error",
      message: "BULLMQ_DRAIN_DELAY_SECONDS must be at least 300 for the Upstash low-command profile.",
    });
  } else {
    results.push({
      name: "BULLMQ_DRAIN_DELAY_SECONDS",
      severity: "ok",
      message: "BullMQ empty-queue long polling is configured for low Redis command usage.",
    });
  }

  if (!Number.isFinite(stalledIntervalMs) || stalledIntervalMs < 300_000) {
    results.push({
      name: "BULLMQ_STALLED_INTERVAL_MS",
      severity: "error",
      message: "BULLMQ_STALLED_INTERVAL_MS must be at least 300000 for the Upstash low-command profile.",
    });
  } else {
    results.push({
      name: "BULLMQ_STALLED_INTERVAL_MS",
      severity: "ok",
      message: "BullMQ stalled recovery remains enabled with a quota-conscious interval.",
    });
  }

  if (!Number.isFinite(publishIntervalMs) || publishIntervalMs < 120_000) {
    results.push({
      name: "REAP_PUBLISH_STATUS_INTERVAL_MS",
      severity: "error",
      message: "REAP_PUBLISH_STATUS_INTERVAL_MS must be at least 120000 for the low-command profile.",
    });
  }

  if (!Number.isFinite(publishTimeoutMs) || publishTimeoutMs < 7_200_000) {
    results.push({
      name: "REAP_PUBLISH_STATUS_TIMEOUT_MS",
      severity: "error",
      message: "REAP_PUBLISH_STATUS_TIMEOUT_MS must cover at least two hours.",
    });
  }

  if (!Number.isInteger(plannedVideos) || plannedVideos < 0) {
    results.push({
      name: "REDIS_PLANNED_VIDEOS_PER_MONTH",
      severity: "error",
      message: "REDIS_PLANNED_VIDEOS_PER_MONTH must be a non-negative integer.",
    });
  }

  if (!Number.isInteger(plannedPublishes) || plannedPublishes < 0) {
    results.push({
      name: "REDIS_PLANNED_PUBLISHES_PER_MONTH",
      severity: "error",
      message: "REDIS_PLANNED_PUBLISHES_PER_MONTH must be a non-negative integer.",
    });
  }

  if (
    Number.isFinite(drainDelaySeconds) &&
    drainDelaySeconds > 0 &&
    Number.isFinite(stalledIntervalMs) &&
    stalledIntervalMs > 0 &&
    Number.isFinite(monthlyQuota) &&
    monthlyQuota > 0 &&
    Number.isInteger(plannedVideos) &&
    plannedVideos >= 0 &&
    Number.isInteger(plannedPublishes) &&
    plannedPublishes >= 0
  ) {
    const budget = estimateRedisCommandBudget({
      monthlyQuota,
      plannedVideos,
      plannedPublishes,
      drainDelaySeconds,
      stalledIntervalMs,
      reapPollingInitialDelayMs: reapInitialDelayMs,
      reapPollingTimeoutMs: reapTimeoutMs,
      publishStatusTimeoutMs: publishTimeoutMs,
    });
    const ratio = budget.modeledKnownCycles / monthlyQuota;

    results.push({
      name: "Redis monthly command budget",
      severity: ratio <= 0.5 ? "ok" : "warning",
      message: `Modeled BullMQ maintenance and delayed-wait cycles use ${budget.modeledKnownCycles.toLocaleString("en-US")} commands per 30 days (${Math.round(ratio * 100)}% of quota) for ${plannedVideos} videos and ${plannedPublishes} publishes, before job lifecycle traffic and monitoring.`,
    });
  }
}

function validateOAuth(env: Env, results: ProductionCheckResult[]) {
  const google = getProviderPair(env, "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  const github = getProviderPair(env, "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "GITHUB_ID", "GITHUB_SECRET");

  if (google.partial || github.partial) {
    results.push({
      name: "OAuth providers",
      severity: "error",
      message: "OAuth provider credentials must be configured as complete id/secret pairs.",
    });
    return;
  }

  if (!google.configured && !github.configured) {
    results.push({
      name: "OAuth providers",
      severity: "error",
      message: "Configure at least one OAuth provider for production sign-in.",
    });
    return;
  }

  results.push({
    name: "OAuth providers",
    severity: "ok",
    message: "At least one production OAuth provider is configured.",
  });
}

function validateStorage(env: Env, results: ProductionCheckResult[]) {
  const provider = env.STORAGE_PROVIDER || "supabase";

  if (provider !== "supabase") {
    results.push({
      name: "STORAGE_PROVIDER",
      severity: "error",
      message: "Only STORAGE_PROVIDER=supabase is implemented in the current MVP.",
    });
    return;
  }

  results.push({
    name: "STORAGE_PROVIDER",
    severity: "ok",
    message: "Supabase storage provider is selected.",
  });

  validateHttpsUrl(env.SUPABASE_URL, "SUPABASE_URL", results);
  requireSecret(env, "SUPABASE_SERVICE_ROLE_KEY", results, 24);
  requireValue(env, "SUPABASE_STORAGE_BUCKET", results);
}

function validateWebhook(env: Env, results: ProductionCheckResult[]) {
  requireSecret(env, "REAP_WEBHOOK_SECRET", results);

  if (env.REAP_WEBHOOK_REQUIRE_TIMESTAMP !== "true") {
    results.push({
      name: "REAP_WEBHOOK_REQUIRE_TIMESTAMP",
      severity: "warning",
      message: "Enable REAP_WEBHOOK_REQUIRE_TIMESTAMP=true if Reap sends timestamped signatures.",
    });
  } else {
    results.push({
      name: "REAP_WEBHOOK_REQUIRE_TIMESTAMP",
      severity: "ok",
      message: "Timestamp checking is enabled for webhook replay protection.",
    });
  }

  validatePositiveInteger(env, "REAP_WEBHOOK_TOLERANCE_SECONDS", results);
}

export function validateProductionEnv(env: Env = process.env): ProductionCheckResult[] {
  const results: ProductionCheckResult[] = [];

  if (env.NODE_ENV !== "production") {
    results.push({
      name: "NODE_ENV",
      severity: "error",
      message: "NODE_ENV must be production for a production deployment.",
    });
  } else {
    results.push({
      name: "NODE_ENV",
      severity: "ok",
      message: "NODE_ENV is production.",
    });
  }

  validateHttpsUrl(env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL", results);
  validateHttpsUrl(env.NEXTAUTH_URL, "NEXTAUTH_URL", results);
  requireSecret(env, "NEXTAUTH_SECRET", results);

  if (env.ALLOW_DEV_AUTH === "true") {
    results.push({
      name: "ALLOW_DEV_AUTH",
      severity: "error",
      message: "ALLOW_DEV_AUTH must be false or unset in production.",
    });
  } else {
    results.push({
      name: "ALLOW_DEV_AUTH",
      severity: "ok",
      message: "Development auth fallback is disabled.",
    });
  }

  validateOAuth(env, results);

  validateConnectionUrl(env.DATABASE_URL, "DATABASE_URL", ["postgresql:", "postgres:"], results);
  validateConnectionUrl(env.DIRECT_URL, "DIRECT_URL", ["postgresql:", "postgres:"], results);
  validateDatabasePool(env, results);
  validateConnectionUrl(env.REDIS_URL, "REDIS_URL", ["redis:", "rediss:"], results);
  validateStorage(env, results);
  requireSecret(env, "REAP_API_KEY", results, 16);
  validateWebhook(env, results);
  validateProductionRateLimit(env, results);
  validatePollingFallback(env, results);
  validateRedisCommandBudget(env, results);

  for (const name of [
    "REAP_WORKER_CONCURRENCY",
    "REAP_POLLING_CONCURRENCY",
    "REAP_CLIP_DOWNLOAD_CONCURRENCY",
    "REAP_PUBLISH_CONCURRENCY",
    "REAP_PUBLISH_STATUS_CONCURRENCY",
    "REAP_POLLING_INITIAL_DELAY_MS",
    "REAP_POLL_INTERVAL_MS",
    "REAP_POLL_TIMEOUT_MS",
    "REAP_PUBLISH_STATUS_INTERVAL_MS",
    "REAP_PUBLISH_STATUS_TIMEOUT_MS",
    "BULLMQ_DRAIN_DELAY_SECONDS",
    "BULLMQ_STALLED_INTERVAL_MS",
    "REDIS_MONTHLY_COMMAND_QUOTA",
  ]) {
    validatePositiveInteger(env, name, results);
  }

  return results;
}

export function summarizeProductionChecks(results: ProductionCheckResult[]) {
  return {
    errors: results.filter((result) => result.severity === "error").length,
    warnings: results.filter((result) => result.severity === "warning").length,
    ok: results.filter((result) => result.severity === "ok").length,
  };
}
