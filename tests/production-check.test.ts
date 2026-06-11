import assert from "node:assert/strict";
import test from "node:test";
import { summarizeProductionChecks, validateProductionEnv } from "../src/lib/env/production-check";

const validEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://clipper.example.com",
  NEXTAUTH_URL: "https://clipper.example.com",
  NEXTAUTH_SECRET: "nextauth_secret_with_more_than_32_chars",
  ALLOW_DEV_AUTH: "false",
  AUTH_GOOGLE_ID: "google-client-id",
  AUTH_GOOGLE_SECRET: "google-client-secret",
  DATABASE_URL: "postgresql://user:pass@db.example.com:6543/app?connection_limit=1&pool_timeout=20",
  DIRECT_URL: "postgresql://user:pass@db.example.com:5432/app",
  REDIS_URL: "redis://redis.example.com:6379",
  STORAGE_PROVIDER: "supabase",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "supabase_service_role_key_long_enough",
  SUPABASE_STORAGE_BUCKET: "clips",
  REAP_API_KEY: "reap_api_key_long_enough",
  REAP_WEBHOOK_SECRET: "reap_webhook_secret_with_more_than_32_chars",
  REAP_WEBHOOK_REQUIRE_TIMESTAMP: "true",
  REAP_WEBHOOK_TOLERANCE_SECONDS: "300",
  REAP_RATE_LIMIT_MAX_REQUESTS: "10",
  REAP_RATE_LIMIT_WINDOW_MS: "60000",
};

function errorsFor(env: Record<string, string | undefined>) {
  return validateProductionEnv(env).filter((result) => result.severity === "error");
}

test("accepts a complete production environment", () => {
  const summary = summarizeProductionChecks(validateProductionEnv(validEnv));

  assert.equal(summary.errors, 0);
});

test("rejects development auth fallback in production", () => {
  const errors = errorsFor({
    ...validEnv,
    ALLOW_DEV_AUTH: "true",
  });

  assert.ok(errors.some((error) => error.name === "ALLOW_DEV_AUTH"));
});

test("rejects missing webhook secret", () => {
  const errors = errorsFor({
    ...validEnv,
    REAP_WEBHOOK_SECRET: "",
  });

  assert.ok(errors.some((error) => error.name === "REAP_WEBHOOK_SECRET"));
});

test("rejects unsafe production URLs", () => {
  const errors = errorsFor({
    ...validEnv,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXTAUTH_URL: "http://localhost:3000",
  });

  assert.ok(errors.some((error) => error.name === "NEXT_PUBLIC_APP_URL"));
  assert.ok(errors.some((error) => error.name === "NEXTAUTH_URL"));
});

test("rejects localhost database and Redis URLs", () => {
  const errors = errorsFor({
    ...validEnv,
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/app",
    REDIS_URL: "redis://localhost:6379",
  });

  assert.ok(errors.some((error) => error.name === "DATABASE_URL"));
  assert.ok(errors.some((error) => error.name === "REDIS_URL"));
});

test("rejects an unsafe Prisma connection budget", () => {
  const errors = errorsFor({
    ...validEnv,
    DATABASE_URL: "postgresql://user:pass@db.example.com:6543/app?connection_limit=4",
  });

  assert.ok(errors.some((error) => error.name === "DATABASE_URL connection_limit"));
  assert.ok(errors.some((error) => error.name === "DATABASE_URL pool_timeout"));
});

test("detects Supabase transaction and session pooler modes without exposing credentials", () => {
  const transactionResults = validateProductionEnv({
    ...validEnv,
    DATABASE_URL: "postgresql://secret-user:secret-pass@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?connection_limit=1&pool_timeout=20",
    DIRECT_URL: "postgresql://secret-user:secret-pass@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
  });
  const sessionResults = validateProductionEnv({
    ...validEnv,
    DATABASE_URL: "postgresql://secret-user:secret-pass@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?connection_limit=1&pool_timeout=20",
  });

  assert.ok(
    transactionResults.some(
      (result) => result.name === "DATABASE_URL Supabase mode" && result.severity === "ok",
    ),
  );
  assert.ok(
    sessionResults.some(
      (result) => result.name === "DATABASE_URL Supabase mode" && result.severity === "warning",
    ),
  );
  assert.ok(
    [...transactionResults, ...sessionResults].every(
      (result) => !result.message.includes("secret-user") && !result.message.includes("secret-pass"),
    ),
  );
});

test("rejects a Supabase transaction pooler URL for migrations", () => {
  const errors = errorsFor({
    ...validEnv,
    DIRECT_URL: "postgresql://user:pass@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
  });

  assert.ok(errors.some((error) => error.name === "DIRECT_URL Supabase mode"));
});

test("rejects Reap rate limits above documented production cap", () => {
  const errors = errorsFor({
    ...validEnv,
    REAP_RATE_LIMIT_MAX_REQUESTS: "20",
  });

  assert.ok(errors.some((error) => error.name === "REAP_RATE_LIMIT_MAX_REQUESTS"));
});

test("rejects aggressive Reap polling fallback timing", () => {
  const errors = errorsFor({
    ...validEnv,
    REAP_POLLING_INITIAL_DELAY_MS: "1000",
    REAP_POLL_INTERVAL_MS: "30000",
    REAP_POLL_TIMEOUT_MS: "3600000",
  });

  assert.ok(errors.some((error) => error.name === "REAP_POLLING_INITIAL_DELAY_MS"));
  assert.ok(errors.some((error) => error.name === "REAP_POLL_INTERVAL_MS"));
  assert.ok(errors.some((error) => error.name === "REAP_POLL_TIMEOUT_MS"));
});

test("rejects Redis settings that exceed the low-command maintenance profile", () => {
  const errors = errorsFor({
    ...validEnv,
    BULLMQ_DRAIN_DELAY_SECONDS: "30",
    BULLMQ_STALLED_INTERVAL_MS: "30000",
    REAP_PUBLISH_STATUS_INTERVAL_MS: "30000",
  });

  assert.ok(errors.some((error) => error.name === "BULLMQ_DRAIN_DELAY_SECONDS"));
  assert.ok(errors.some((error) => error.name === "BULLMQ_STALLED_INTERVAL_MS"));
  assert.ok(errors.some((error) => error.name === "REAP_PUBLISH_STATUS_INTERVAL_MS"));
});

test("warns when planned queue traffic consumes too much of the Redis quota", () => {
  const results = validateProductionEnv({
    ...validEnv,
    REDIS_PLANNED_VIDEOS_PER_MONTH: "500",
    REDIS_PLANNED_PUBLISHES_PER_MONTH: "500",
  });

  assert.ok(
    results.some(
      (result) =>
        result.name === "Redis monthly command budget" &&
        result.severity === "warning",
    ),
  );
});
