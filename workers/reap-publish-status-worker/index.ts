import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import {
  DEFAULT_REAP_PUBLISH_STATUS_CONCURRENCY,
  REAP_PUBLISH_STATUS_QUEUE_NAME,
} from "../../src/lib/queue/reap-publish-status-queue";
import { startReapPublishStatusWorker } from "./processor";

function getWorkerConcurrency() {
  const value = Number(process.env.REAP_PUBLISH_STATUS_CONCURRENCY ?? DEFAULT_REAP_PUBLISH_STATUS_CONCURRENCY);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REAP_PUBLISH_STATUS_CONCURRENCY;
}

const worker = startReapPublishStatusWorker(getWorkerConcurrency());

worker.on("ready", () => {
  console.log(`[reap-publish-status-worker] Listening on queue "${REAP_PUBLISH_STATUS_QUEUE_NAME}"`);
});

async function shutdown(signal: string) {
  console.log(`[reap-publish-status-worker] Received ${signal}; shutting down`);

  await worker.close();
  await prisma.$disconnect();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
