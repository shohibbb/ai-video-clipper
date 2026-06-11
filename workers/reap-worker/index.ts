import "dotenv/config";
import { Worker } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import {
  VIDEO_PROCESSING_QUEUE_NAME,
  DEFAULT_REAP_WORKER_CONCURRENCY,
} from "../../src/lib/queue/video-queue";
import type { VideoProcessingJobData } from "../../src/lib/queue/video-queue";
import { createWorkerRedisConnection } from "../../src/lib/queue/redis";
import { getBullMqWorkerMaintenanceOptions } from "../../src/lib/queue/worker-options";
import { processReapVideoJob } from "./processor";

function getWorkerConcurrency() {
  const value = Number(process.env.REAP_WORKER_CONCURRENCY ?? DEFAULT_REAP_WORKER_CONCURRENCY);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REAP_WORKER_CONCURRENCY;
}

const workerConnection = createWorkerRedisConnection("ai-video-clipper-reap-worker");

const worker = new Worker<VideoProcessingJobData>(VIDEO_PROCESSING_QUEUE_NAME, processReapVideoJob, {
  connection: workerConnection,
  concurrency: getWorkerConcurrency(),
  ...getBullMqWorkerMaintenanceOptions(),
});

worker.on("ready", () => {
  console.log(`[reap-worker] Listening on queue "${VIDEO_PROCESSING_QUEUE_NAME}"`);
});

worker.on("completed", (job) => {
  console.log(`[reap-worker] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`[reap-worker] Job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

worker.on("stalled", (jobId) => {
  console.warn(`[reap-worker] Job ${jobId} stalled`);
});

async function shutdown(signal: string) {
  console.log(`[reap-worker] Received ${signal}; shutting down`);

  await worker.close();
  await workerConnection.quit();
  await prisma.$disconnect();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
