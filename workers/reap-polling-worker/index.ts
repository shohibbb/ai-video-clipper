import { Worker } from "bullmq";
import { logEvent } from "@/lib/observability/logger";
import { startReapPollingWorker } from "./processor";

const WORKER_CONCURRENCY = parseInt(process.env.REAP_POLLING_CONCURRENCY ?? "1", 10);

async function main() {
  const shutdown: Array<() => Promise<void>> = [];

  const worker = startReapPollingWorker(WORKER_CONCURRENCY);
  shutdown.push(async () => {
    await worker.close();
  });

  await logEvent({
    level: "info",
    event: "reap.polling.worker.started",
    component: "reap-polling-worker",
    message: `Reap polling worker started with concurrency ${WORKER_CONCURRENCY}.`,
  });

  const gracefulShutdown = async (signal: string) => {
    await logEvent({
      level: "info",
      event: "reap.polling.worker.shutting_down",
      component: "reap-polling-worker",
      message: `Received ${signal}. Shutting down...`,
    });
    for (const close of shutdown) {
      await close();
    }
    process.exit(0);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

main().catch((error) => {
  console.error("Reap polling worker failed to start:", error);
  process.exit(1);
});