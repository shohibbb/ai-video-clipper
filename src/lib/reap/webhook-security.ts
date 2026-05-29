import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_HEADERS = ["x-reap-signature", "reap-signature", "x-webhook-signature", "x-signature"];
const SECRET_HEADERS = ["x-reap-webhook-secret", "reap-webhook-secret", "x-webhook-secret"];
const TIMESTAMP_HEADERS = ["x-reap-timestamp", "reap-timestamp", "x-webhook-timestamp"];
const DEFAULT_TOLERANCE_SECONDS = 300;

export type ReapWebhookVerificationMethod = "unsigned" | "hmac" | "shared_secret";

export type ReapWebhookVerificationResult =
  | {
      ok: true;
      method: ReapWebhookVerificationMethod;
    }
  | {
      ok: false;
      reason:
        | "missing_secret"
        | "missing_signature"
        | "missing_timestamp"
        | "invalid_timestamp"
        | "stale_timestamp"
        | "invalid_signature";
    };

type HeaderSource = Headers | Record<string, string | string[] | undefined>;

type VerifyReapWebhookRequestInput = {
  body: string;
  headers: HeaderSource;
  url?: string;
  secret?: string | null;
  requireTimestamp?: boolean;
  toleranceSeconds?: number;
  now?: Date;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function getHeader(headers: HeaderSource, name: string) {
  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const lowerName = name.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) {
      continue;
    }

    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }

  return null;
}

function getFirstHeader(headers: HeaderSource, names: string[]) {
  for (const name of names) {
    const value = getHeader(headers, name);

    if (hasValue(value)) {
      return value!.trim();
    }
  }

  return null;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getQuerySecret(url: string | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.searchParams.get("reap_webhook_secret") ??
      parsedUrl.searchParams.get("webhook_secret") ??
      parsedUrl.searchParams.get("secret")
    );
  } catch {
    return null;
  }
}

function getTimestampMs(value: string) {
  const timestamp = Number(value);

  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  return timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
}

function verifyTimestamp(
  timestampHeader: string | null,
  requireTimestamp: boolean,
  toleranceSeconds: number,
  now: Date,
): ReapWebhookVerificationResult | null {
  if (!timestampHeader) {
    return requireTimestamp ? { ok: false, reason: "missing_timestamp" } : null;
  }

  const timestampMs = getTimestampMs(timestampHeader);

  if (!timestampMs) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const toleranceMs = toleranceSeconds * 1000;
  const ageMs = Math.abs(now.getTime() - timestampMs);

  if (ageMs > toleranceMs) {
    return { ok: false, reason: "stale_timestamp" };
  }

  return null;
}

function extractSignatureCandidates(rawSignature: string) {
  return rawSignature
    .split(",")
    .map((part) => part.trim())
    .flatMap((part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex === -1) {
        return [part];
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      if (key === "sha256" || key === "v1" || key === "signature") {
        return [value];
      }

      return [];
    })
    .map((signature) => signature.replace(/^sha256=/i, "").trim())
    .filter((signature) => /^[a-f0-9]{64}$/i.test(signature));
}

function createSignatures(secret: string, body: string, timestampHeader: string | null) {
  const payloads = [body];

  if (timestampHeader) {
    payloads.push(`${timestampHeader}.${body}`);
  }

  return payloads.map((payload) => createHmac("sha256", secret).update(payload).digest("hex"));
}

function verifyHmacSignature(secret: string, body: string, timestampHeader: string | null, rawSignature: string) {
  const candidates = extractSignatureCandidates(rawSignature);

  if (candidates.length === 0) {
    return false;
  }

  const expectedSignatures = createSignatures(secret, body, timestampHeader);

  return candidates.some((candidate) => expectedSignatures.some((expected) => safeCompare(candidate, expected)));
}

export function verifyReapWebhookRequest({
  body,
  headers,
  url,
  secret,
  requireTimestamp = false,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  now = new Date(),
}: VerifyReapWebhookRequestInput): ReapWebhookVerificationResult {
  const configuredSecret = secret?.trim();

  if (!configuredSecret) {
    return { ok: true, method: "unsigned" };
  }

  const timestampHeader = getFirstHeader(headers, TIMESTAMP_HEADERS);
  const timestampFailure = verifyTimestamp(
    timestampHeader,
    requireTimestamp,
    Number.isFinite(toleranceSeconds) && toleranceSeconds > 0 ? toleranceSeconds : DEFAULT_TOLERANCE_SECONDS,
    now,
  );

  if (timestampFailure) {
    return timestampFailure;
  }

  const sharedSecret = getFirstHeader(headers, SECRET_HEADERS) ?? getQuerySecret(url);

  if (sharedSecret && safeCompare(sharedSecret, configuredSecret)) {
    return { ok: true, method: "shared_secret" };
  }

  const signature = getFirstHeader(headers, SIGNATURE_HEADERS);

  if (!signature) {
    return { ok: false, reason: "missing_signature" };
  }

  if (!verifyHmacSignature(configuredSecret, body, timestampHeader, signature)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, method: "hmac" };
}

export function getReapWebhookSecurityConfig() {
  const toleranceSeconds = Number(process.env.REAP_WEBHOOK_TOLERANCE_SECONDS);

  return {
    secret: process.env.REAP_WEBHOOK_SECRET,
    requireTimestamp: process.env.REAP_WEBHOOK_REQUIRE_TIMESTAMP === "true",
    toleranceSeconds:
      Number.isFinite(toleranceSeconds) && toleranceSeconds > 0 ? toleranceSeconds : DEFAULT_TOLERANCE_SECONDS,
  };
}
