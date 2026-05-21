import "dotenv/config";
import IORedis from "ioredis";
import type { Queue } from "bullmq";
import { Queue as BullQueue } from "bullmq";
import { prisma } from "../src/lib/prisma";
import { CLIP_UPLOAD_QUEUE_NAME } from "../src/lib/queue/upload-queue";
import { VIDEO_PROCESSING_QUEUE_NAME } from "../src/lib/queue/video-queue";
import { REAP_POLLING_QUEUE_NAME } from "../src/lib/queue/reap-polling-queue";

function getTimeoutMs() {
  const value = Number(process.env.WORKER_HEALTHCHECK_TIMEOUT_MS ?? "10000");
  return Number.isFinite(value) && value > 0 ? value : 10000;
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = getTimeoutMs()) {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    }),
  ]);
}

function getRedisUrl() {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

function createHealthRedisConnection(connectionName: string) {
  return new IORedis(getRedisUrl(), {
    connectionName,
    connectTimeout: getTimeoutMs(),
    maxRetriesPerRequest: 1,
  });
}

async function getQueueHealth(name: string, queue: Queue) {
  const counts = await withTimeout(queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused"), `${name} counts`);

  return {
    name,
    counts,
    paused: await withTimeout(queue.isPaused(), `${name} paused status`),
  };
}

async function main() {
  const redis = createHealthRedisConnection("ai-video-clipper-healthcheck");
  const videoConnection = createHealthRedisConnection("ai-video-clipper-health-video-queue");
  const uploadConnection = createHealthRedisConnection("ai-video-clipper-health-upload-queue");
  const pollingConnection = createHealthRedisConnection("ai-video-clipper-health-polling-queue");
  const videoQueue = new BullQueue(VIDEO_PROCESSING_QUEUE_NAME, {
    connection: videoConnection,
  });
  const uploadQueue = new BullQueue(CLIP_UPLOAD_QUEUE_NAME, {
    connection: uploadConnection,
  });
  const pollingQueue = new BullQueue(REAP_POLLING_QUEUE_NAME, {
    connection: pollingConnection,
  });

  try {
    const redisPing = await withTimeout(redis.ping(), "Redis ping");
    const [videoProcessing, clipUpload, reapPolling, databaseJobs] = await Promise.all([
      getQueueHealth("video-processing", videoQueue),
      getQueueHealth("clip-upload", uploadQueue),
      getQueueHealth("reap-polling", pollingQueue),
      withTimeout(
        prisma.job.groupBy({
          by: ["jobType", "status"],
          _count: {
            _all: true,
          },
        }),
        "Database job count query",
      ),
    ]);

    const payload = {
      ok: redisPing === "PONG",
      checkedAt: new Date().toISOString(),
      redis: {
        ping: redisPing,
      },
      queues: [videoProcessing, clipUpload, reapPolling],
      databaseJobs: databaseJobs.map((row) => ({
        jobType: row.jobType,
        status: row.status,
        count: row._count._all,
      })),
    };

    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = payload.ok ? 0 : 1;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          checkedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Worker health check failed.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    videoQueue.disconnect();
    uploadQueue.disconnect();
    pollingQueue.disconnect();
    redis.disconnect();
    videoConnection.disconnect();
    uploadConnection.disconnect();
    pollingConnection.disconnect();
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  }
}

void main();
