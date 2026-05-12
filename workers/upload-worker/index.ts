import "dotenv/config";
import { QueueEvents, Worker } from "bullmq";
import { prisma } from "../../src/lib/prisma";
import {
  CLIP_UPLOAD_QUEUE_NAME,
  DEFAULT_UPLOAD_WORKER_CONCURRENCY,
} from "../../src/lib/queue/upload-queue";
import type { ClipUploadJobData } from "../../src/lib/queue/upload-queue";
import { createWorkerRedisConnection } from "../../src/lib/queue/redis";
import { processClipUploadJob } from "./processor";

function getWorkerConcurrency() {
  const value = Number(process.env.UPLOAD_WORKER_CONCURRENCY ?? DEFAULT_UPLOAD_WORKER_CONCURRENCY);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_UPLOAD_WORKER_CONCURRENCY;
}

const workerConnection = createWorkerRedisConnection("ai-video-clipper-upload-worker");
const eventsConnection = createWorkerRedisConnection("ai-video-clipper-upload-events");

const worker = new Worker<ClipUploadJobData>(CLIP_UPLOAD_QUEUE_NAME, processClipUploadJob, {
  connection: workerConnection,
  concurrency: getWorkerConcurrency(),
});

const queueEvents = new QueueEvents(CLIP_UPLOAD_QUEUE_NAME, {
  connection: eventsConnection,
});

worker.on("ready", () => {
  console.log(`[upload-worker] Listening on queue "${CLIP_UPLOAD_QUEUE_NAME}"`);
});

worker.on("completed", (job) => {
  console.log(`[upload-worker] Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`[upload-worker] Job ${job?.id ?? "unknown"} failed: ${error.message}`);
});

queueEvents.on("waiting", ({ jobId }) => {
  console.log(`[upload-worker] Job ${jobId} waiting`);
});

queueEvents.on("stalled", ({ jobId }) => {
  console.warn(`[upload-worker] Job ${jobId} stalled`);
});

async function shutdown(signal: string) {
  console.log(`[upload-worker] Received ${signal}; shutting down`);

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
