import "dotenv/config";
import { getReapPollingConfig } from "../src/lib/queue/reap-polling-queue";
import { getReapPublishStatusConfig } from "../src/lib/queue/reap-publish-status-queue";
import {
  estimateRedisCommandBudget,
  getBullMqWorkerMaintenanceOptions,
} from "../src/lib/queue/worker-options";

const monthlyQuota = Number(process.env.REDIS_MONTHLY_COMMAND_QUOTA ?? "500000");
const plannedVideos = Number(process.env.REDIS_PLANNED_VIDEOS_PER_MONTH ?? "100");
const plannedPublishes = Number(process.env.REDIS_PLANNED_PUBLISHES_PER_MONTH ?? "100");
const workerOptions = getBullMqWorkerMaintenanceOptions();
const reapPolling = getReapPollingConfig();
const publishPolling = getReapPublishStatusConfig();
const budget = estimateRedisCommandBudget({
  monthlyQuota,
  plannedVideos,
  plannedPublishes,
  drainDelaySeconds: workerOptions.drainDelay,
  stalledIntervalMs: workerOptions.stalledInterval,
  reapPollingInitialDelayMs: reapPolling.initialDelayMs,
  reapPollingTimeoutMs: reapPolling.timeoutMs,
  publishStatusTimeoutMs: publishPolling.timeoutMs,
});

console.log(
  JSON.stringify(
    {
      monthlyQuota,
      plannedVideos,
      plannedPublishes,
      workerOptions,
      budget,
      maxApplicationPolls: {
        reapProjectPerVideo: reapPolling.maxAttempts,
        reapPublishPerUpload: publishPolling.maxAttempts,
      },
      note: "This model includes idle maintenance and BullMQ delayed-job wake cycles. It is not a provider bill forecast: job lifecycle commands, failures, retries, rate limiting, health checks, and monitoring add usage.",
    },
    null,
    2,
  ),
);
