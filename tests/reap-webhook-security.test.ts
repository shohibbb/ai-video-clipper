import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { verifyReapWebhookRequest } from "../src/lib/reap/webhook-security";

const body = JSON.stringify({
  projectId: "project_123",
  projectType: "clipping",
  source: "Generic",
  status: "completed",
});
const secret = "a_webhook_secret_with_enough_entropy_123";

function sign(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

test("allows unsigned Reap webhooks when no secret is configured", () => {
  const result = verifyReapWebhookRequest({
    body,
    headers: new Headers(),
  });

  assert.deepEqual(result, { ok: true, method: "unsigned" });
});

test("rejects signed-mode Reap webhooks without credentials", () => {
  const result = verifyReapWebhookRequest({
    body,
    headers: new Headers(),
    secret,
  });

  assert.deepEqual(result, { ok: false, reason: "missing_signature" });
});

test("accepts HMAC-signed Reap webhooks", () => {
  const result = verifyReapWebhookRequest({
    body,
    headers: new Headers({
      "x-reap-signature": `sha256=${sign(body)}`,
    }),
    secret,
  });

  assert.deepEqual(result, { ok: true, method: "hmac" });
});

test("accepts timestamped HMAC-signed Reap webhooks", () => {
  const timestamp = "1767000000";
  const result = verifyReapWebhookRequest({
    body,
    headers: new Headers({
      "x-reap-timestamp": timestamp,
      "x-reap-signature": `v1=${sign(`${timestamp}.${body}`)}`,
    }),
    secret,
    requireTimestamp: true,
    now: new Date(Number(timestamp) * 1000),
  });

  assert.deepEqual(result, { ok: true, method: "hmac" });
});

test("rejects stale timestamped Reap webhooks", () => {
  const timestamp = "1767000000";
  const result = verifyReapWebhookRequest({
    body,
    headers: new Headers({
      "x-reap-timestamp": timestamp,
      "x-reap-signature": `v1=${sign(`${timestamp}.${body}`)}`,
    }),
    secret,
    requireTimestamp: true,
    toleranceSeconds: 30,
    now: new Date((Number(timestamp) + 120) * 1000),
  });

  assert.deepEqual(result, { ok: false, reason: "stale_timestamp" });
});

test("accepts shared secret query parameter for providers without custom headers", () => {
  const result = verifyReapWebhookRequest({
    body,
    headers: new Headers(),
    url: `https://example.com/api/reap/webhook?reap_webhook_secret=${encodeURIComponent(secret)}`,
    secret,
  });

  assert.deepEqual(result, { ok: true, method: "shared_secret" });
});
