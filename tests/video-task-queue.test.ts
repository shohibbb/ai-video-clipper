import assert from "node:assert/strict";
import test from "node:test";
import { getVideoEnqueueFailureMessage } from "../src/lib/services/video-task-queue";

test("maps Redis request quota errors to an actionable enqueue message", () => {
  const message = getVideoEnqueueFailureMessage(
    new Error("ERR max requests limit exceeded. Limit: 500000, Usage: 500000."),
  );

  assert.match(message, /Redis request quota has been exceeded/);
  assert.doesNotMatch(message, /REDIS_URL=.*@/);
});
