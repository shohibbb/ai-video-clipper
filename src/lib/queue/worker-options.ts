import type { WorkerOptions } from "bullmq";

export const DEFAULT_BULLMQ_DRAIN_DELAY_SECONDS = 300;
export const DEFAULT_BULLMQ_STALLED_INTERVAL_MS = 300_000;
export const DEFAULT_BULLMQ_WORKER_COUNT = 5;
export const BULLMQ_DELAYED_JOB_MAX_BLOCK_SECONDS = 10;

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getBullMqWorkerMaintenanceOptions(): Pick<
  WorkerOptions,
  "drainDelay" | "stalledInterval"
> {
  return {
    drainDelay: getPositiveIntegerEnv(
      "BULLMQ_DRAIN_DELAY_SECONDS",
      DEFAULT_BULLMQ_DRAIN_DELAY_SECONDS,
    ),
    stalledInterval: getPositiveIntegerEnv(
      "BULLMQ_STALLED_INTERVAL_MS",
      DEFAULT_BULLMQ_STALLED_INTERVAL_MS,
    ),
  };
}

export function estimateBullMqMaintenanceCommandFloor({
  workerCount = DEFAULT_BULLMQ_WORKER_COUNT,
  days = 30,
  drainDelaySeconds = getBullMqWorkerMaintenanceOptions().drainDelay!,
  stalledIntervalMs = getBullMqWorkerMaintenanceOptions().stalledInterval!,
} = {}) {
  const monthSeconds = days * 24 * 60 * 60;
  const emptyQueueLongPolls = workerCount * Math.ceil(monthSeconds / drainDelaySeconds);
  const stalledChecks =
    workerCount * Math.ceil((monthSeconds * 1000) / stalledIntervalMs);

  return {
    workerCount,
    days,
    emptyQueueLongPolls,
    stalledChecks,
    estimatedCommandFloor: emptyQueueLongPolls + stalledChecks,
  };
}

export function estimateRedisCommandBudget({
  monthlyQuota = 500_000,
  plannedVideos = 0,
  plannedPublishes = 0,
  drainDelaySeconds,
  stalledIntervalMs,
  reapPollingInitialDelayMs,
  reapPollingTimeoutMs,
  publishStatusTimeoutMs,
}: {
  monthlyQuota?: number;
  plannedVideos?: number;
  plannedPublishes?: number;
  drainDelaySeconds?: number;
  stalledIntervalMs?: number;
  reapPollingInitialDelayMs: number;
  reapPollingTimeoutMs: number;
  publishStatusTimeoutMs: number;
}) {
  const maintenance = estimateBullMqMaintenanceCommandFloor({
    drainDelaySeconds:
      drainDelaySeconds ?? getBullMqWorkerMaintenanceOptions().drainDelay!,
    stalledIntervalMs:
      stalledIntervalMs ?? getBullMqWorkerMaintenanceOptions().stalledInterval!,
  });
  const delayedBlockMs = BULLMQ_DELAYED_JOB_MAX_BLOCK_SECONDS * 1000;
  const delayedWaitCyclesPerVideo = Math.ceil(
    (reapPollingInitialDelayMs + reapPollingTimeoutMs) / delayedBlockMs,
  );
  const delayedWaitCyclesPerPublish = Math.ceil(
    publishStatusTimeoutMs / delayedBlockMs,
  );
  const plannedDelayedWaitCycles =
    plannedVideos * delayedWaitCyclesPerVideo +
    plannedPublishes * delayedWaitCyclesPerPublish;
  const modeledKnownCycles =
    maintenance.estimatedCommandFloor + plannedDelayedWaitCycles;

  return {
    monthlyQuota,
    plannedVideos,
    plannedPublishes,
    maintenance,
    delayedWaitCyclesPerVideo,
    delayedWaitCyclesPerPublish,
    plannedDelayedWaitCycles,
    modeledKnownCycles,
    remainingForJobLifecycleAndMonitoring: monthlyQuota - modeledKnownCycles,
  };
}
