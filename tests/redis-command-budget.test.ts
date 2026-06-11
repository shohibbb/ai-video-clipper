import assert from "node:assert/strict";
import test from "node:test";
import { getReapPublishStatusConfig } from "../src/lib/queue/reap-publish-status-queue";
import {
  estimateBullMqMaintenanceCommandFloor,
  estimateRedisCommandBudget,
  getBullMqWorkerMaintenanceOptions,
} from "../src/lib/queue/worker-options";

test("defaults BullMQ workers to the Upstash low-command profile", () => {
  const previousDrainDelay = process.env.BULLMQ_DRAIN_DELAY_SECONDS;
  const previousStalledInterval = process.env.BULLMQ_STALLED_INTERVAL_MS;

  delete process.env.BULLMQ_DRAIN_DELAY_SECONDS;
  delete process.env.BULLMQ_STALLED_INTERVAL_MS;

  try {
    assert.deepEqual(getBullMqWorkerMaintenanceOptions(), {
      drainDelay: 300,
      stalledInterval: 300_000,
    });
    assert.deepEqual(estimateBullMqMaintenanceCommandFloor(), {
      workerCount: 5,
      days: 30,
      emptyQueueLongPolls: 43_200,
      stalledChecks: 43_200,
      estimatedCommandFloor: 86_400,
    });
  } finally {
    if (previousDrainDelay === undefined) delete process.env.BULLMQ_DRAIN_DELAY_SECONDS;
    else process.env.BULLMQ_DRAIN_DELAY_SECONDS = previousDrainDelay;
    if (previousStalledInterval === undefined) delete process.env.BULLMQ_STALLED_INTERVAL_MS;
    else process.env.BULLMQ_STALLED_INTERVAL_MS = previousStalledInterval;
  }
});

test("models delayed BullMQ wake cycles for planned monthly workflows", () => {
  const budget = estimateRedisCommandBudget({
    monthlyQuota: 500_000,
    plannedVideos: 100,
    plannedPublishes: 100,
    reapPollingInitialDelayMs: 900_000,
    reapPollingTimeoutMs: 7_200_000,
    publishStatusTimeoutMs: 7_200_000,
  });

  assert.equal(budget.delayedWaitCyclesPerVideo, 810);
  assert.equal(budget.delayedWaitCyclesPerPublish, 720);
  assert.equal(budget.plannedDelayedWaitCycles, 153_000);
  assert.equal(budget.modeledKnownCycles, 239_400);
  assert.equal(budget.remainingForJobLifecycleAndMonitoring, 260_600);
});

test("defaults Reap publish polling to two minutes for two hours", () => {
  const previousInterval = process.env.REAP_PUBLISH_STATUS_INTERVAL_MS;
  const previousTimeout = process.env.REAP_PUBLISH_STATUS_TIMEOUT_MS;

  delete process.env.REAP_PUBLISH_STATUS_INTERVAL_MS;
  delete process.env.REAP_PUBLISH_STATUS_TIMEOUT_MS;

  try {
    assert.deepEqual(getReapPublishStatusConfig(), {
      intervalMs: 120_000,
      timeoutMs: 7_200_000,
      maxAttempts: 60,
    });
  } finally {
    if (previousInterval === undefined) delete process.env.REAP_PUBLISH_STATUS_INTERVAL_MS;
    else process.env.REAP_PUBLISH_STATUS_INTERVAL_MS = previousInterval;
    if (previousTimeout === undefined) delete process.env.REAP_PUBLISH_STATUS_TIMEOUT_MS;
    else process.env.REAP_PUBLISH_STATUS_TIMEOUT_MS = previousTimeout;
  }
});
