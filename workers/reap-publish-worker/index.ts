import "dotenv/config";
import { Worker, QueueEvents } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import {
  CLIP_UPLOAD_QUEUE_NAME,
  DEFAULT_UPLOAD_WORKER_CONCURRENCY,
} from "../../src/lib/queue/upload-queue";
import type { ClipUploadJobData } from "../../src/lib/queue/upload-queue";
import { createWorkerRedisConnection } from "../../src/lib/queue/redis";
import { processReapPublishJob } from "./processor";

function getWorkerConcurrency() {
  const value = Number(process.env.REAP_PUBLISH_CONCURRENCY ?? DEFAULT_UPLOAD_WORKER_CONCURRENCY);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_UPLOAD_WORKER_CONCURRENCY;
}

const workerConnection = createWorkerRedisConnection("ai-video-clipper-reap-publish-worker");
const eventsConnection = createWorkerRedisConnection("ai-video-clipper-reap-publish-events");

const worker = new Worker<ClipUploadJobData>(CLIP_UPLOAD_QUEUE_NAME, processReapPublishJob, {
  connection: workerConnection,
  concurrency: getWorkerConcurrency(),
});

const queueEvents = new QueueEvents(CLIP_UPLOAD_QUEUE_NAME, {
  connection: eventsConnection,
});

worker.on("ready", () => {
  console.log(`[reap-publish-worker] Listening on queue "${CLIP_UPLOAD_QUEUE_NAME}"`);
});

worker.on("completed", (job) => {
  console.log(`[reap-publish-worker] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`[reap-publish-worker] Job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

queueEvents.on("waiting", ({ jobId }) => {
  console.log(`[reap-publish-worker] Job ${jobId} waiting`);
});

queueEvents.on("stalled", ({ jobId }) => {
  console.warn(`[reap-publish-worker] Job ${jobId} stalled`);
});

async function shutdown(signal: string) {
  console.log(`[reap-publish-worker] Received ${signal}; shutting down`);

  await worker.close();
  await queueEvents.close();
  await workerConnection.quit();
  await eventsConnection.quit();
  await prisma.$disconnect();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});