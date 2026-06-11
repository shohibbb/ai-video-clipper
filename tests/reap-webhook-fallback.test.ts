import assert from "node:assert/strict";
import test from "node:test";
import {
  getReapClipDownloadJobId,
  getReapPollingJobId,
} from "../src/lib/queue/reap-job-identity";
import { getReapPollingConfig } from "../src/lib/queue/reap-polling-queue";
import { classifyReapProjectStatus } from "../src/lib/reap/project-status";

test("uses stable distinct identities for polling and clip download jobs", () => {
  const videoId = "11111111-1111-4111-8111-111111111111";
  const projectId = "reap-project-1";

  const pollingId = getReapPollingJobId(videoId, projectId);
  const downloadId = getReapClipDownloadJobId(videoId, projectId);

  assert.equal(pollingId, getReapPollingJobId(videoId, projectId));
  assert.equal(downloadId, getReapClipDownloadJobId(videoId, projectId));
  assert.notEqual(pollingId, downloadId);
  assert.match(pollingId, /^[0-9a-f-]{36}$/);
  assert.match(downloadId, /^[0-9a-f-]{36}$/);
});

test("defaults polling fallback to fifteen minutes, five minutes, and two hours", () => {
  const previousValues = {
    initialDelay: process.env.REAP_POLLING_INITIAL_DELAY_MS,
    interval: process.env.REAP_POLL_INTERVAL_MS,
    timeout: process.env.REAP_POLL_TIMEOUT_MS,
  };

  delete process.env.REAP_POLLING_INITIAL_DELAY_MS;
  delete process.env.REAP_POLL_INTERVAL_MS;
  delete process.env.REAP_POLL_TIMEOUT_MS;

  try {
    assert.deepEqual(getReapPollingConfig(), {
      initialDelayMs: 900_000,
      intervalMs: 300_000,
      timeoutMs: 7_200_000,
      maxAttempts: 24,
    });
  } finally {
    if (previousValues.initialDelay === undefined) delete process.env.REAP_POLLING_INITIAL_DELAY_MS;
    else process.env.REAP_POLLING_INITIAL_DELAY_MS = previousValues.initialDelay;
    if (previousValues.interval === undefined) delete process.env.REAP_POLL_INTERVAL_MS;
    else process.env.REAP_POLL_INTERVAL_MS = previousValues.interval;
    if (previousValues.timeout === undefined) delete process.env.REAP_POLL_TIMEOUT_MS;
    else process.env.REAP_POLL_TIMEOUT_MS = previousValues.timeout;
  }
});

test("classifies Reap terminal and processing statuses", () => {
  assert.equal(classifyReapProjectStatus("completed"), "completed");
  assert.equal(classifyReapProjectStatus("invalid"), "failed");
  assert.equal(classifyReapProjectStatus("expired"), "failed");
  assert.equal(classifyReapProjectStatus("processing"), "processing");
  assert.equal(classifyReapProjectStatus("finalizing"), "processing");
});
