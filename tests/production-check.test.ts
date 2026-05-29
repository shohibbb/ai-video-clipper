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
  DATABASE_URL: "postgresql://user:pass@db.example.com:5432/app",
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

test("rejects Reap rate limits above documented production cap", () => {
  const errors = errorsFor({
    ...validEnv,
    REAP_RATE_LIMIT_MAX_REQUESTS: "20",
  });

  assert.ok(errors.some((error) => error.name === "REAP_RATE_LIMIT_MAX_REQUESTS"));
});
