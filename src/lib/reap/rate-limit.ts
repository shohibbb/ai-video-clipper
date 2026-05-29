import { createHash, randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { createQueueRedisConnection } from "@/lib/queue/redis";

const DEFAULT_REAP_RATE_LIMIT_MAX_REQUESTS = 10;
const DEFAULT_REAP_RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_KEY_PREFIX = "ai-video-clipper:reap:rate-limit";

let redis: Redis | null = null;
let warnedAboutRedisFallback = false;
let localRequestTimestamps: number[] = [];

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getMaxRequests() {
  return getPositiveNumberEnv("REAP_RATE_LIMIT_MAX_REQUESTS", DEFAULT_REAP_RATE_LIMIT_MAX_REQUESTS);
}

function getWindowMs() {
  return getPositiveNumberEnv("REAP_RATE_LIMIT_WINDOW_MS", DEFAULT_REAP_RATE_LIMIT_WINDOW_MS);
}

function getRedis() {
  redis ??= createQueueRedisConnection("ai-video-clipper-reap-rate-limit");
  return redis;
}

function getApiKeyHash(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWithLocalLimiter(maxRequests: number, windowMs: number) {
  const now = Date.now();
  localRequestTimestamps = localRequestTimestamps.filter((timestamp) => now - timestamp < windowMs);

  if (localRequestTimestamps.length >= maxRequests) {
    const oldestTimestamp = localRequestTimestamps[0];
    await sleep(Math.max(0, windowMs - (now - oldestTimestamp)) + 50);
  }

  localRequestTimestamps.push(Date.now());
}

export async function waitForReapRateLimit(apiKey: string) {
  const maxRequests = getMaxRequests();
  const windowMs = getWindowMs();

  if (maxRequests <= 0 || windowMs <= 0) {
    return;
  }

  const key = `${RATE_LIMIT_KEY_PREFIX}:${getApiKeyHash(apiKey)}`;
  const member = `${Date.now()}:${randomUUID()}`;

  try {
    for (;;) {
      const now = Date.now();
      const result = await getRedis().eval(
        `
          local now = tonumber(ARGV[1])
          local window = tonumber(ARGV[2])
          local max = tonumber(ARGV[3])
          redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, now - window)
          local current = redis.call("ZCARD", KEYS[1])
          if current < max then
            redis.call("ZADD", KEYS[1], now, ARGV[4])
            redis.call("PEXPIRE", KEYS[1], window)
            return 0
          end
          local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")[2]
          return math.max(0, window - (now - tonumber(oldest)) + 50)
        `,
        1,
        key,
        now,
        windowMs,
        maxRequests,
        member,
      );
      const waitMs = Number(result);

      if (!Number.isFinite(waitMs) || waitMs <= 0) {
        return;
      }

      await sleep(waitMs);
    }
  } catch (error) {
    if (!warnedAboutRedisFallback) {
      warnedAboutRedisFallback = true;
      console.warn(
        JSON.stringify({
          level: "warning",
          event: "reap.rate_limit.redis_unavailable",
          component: "reap-rate-limit",
          message: "Redis rate limiter unavailable. Falling back to process-local Reap rate limiting.",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    await waitWithLocalLimiter(maxRequests, windowMs);
  }
}
