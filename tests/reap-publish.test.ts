import assert from "node:assert/strict";
import test from "node:test";
import type { ReapPost } from "../src/lib/reap";
import {
  isReapPostPending,
  isTikTokPostCompleted,
  isTikTokPostFailed,
} from "../src/lib/services/reap-publish";

function makePost(overrides: Partial<ReapPost> = {}): ReapPost {
  return {
    id: "post_123",
    platforms: ["tiktok"],
    successPlatforms: [],
    failedPlatforms: [],
    integrations: ["integration_123"],
    status: "processing",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test("identifies completed TikTok posts", () => {
  const post = makePost({
    status: "completed",
    successPlatforms: ["tiktok"],
  });

  assert.equal(isTikTokPostCompleted(post), true);
  assert.equal(isTikTokPostFailed(post), false);
  assert.equal(isReapPostPending(post), false);
});

test("identifies failed TikTok posts from terminal status", () => {
  const post = makePost({
    status: "failed",
    failedPlatforms: ["tiktok"],
  });

  assert.equal(isTikTokPostCompleted(post), false);
  assert.equal(isTikTokPostFailed(post), true);
  assert.equal(isReapPostPending(post), false);
});

test("identifies failed TikTok posts from platform failure", () => {
  const post = makePost({
    status: "processing",
    failedPlatforms: ["tiktok"],
  });

  assert.equal(isTikTokPostFailed(post), true);
});

test("identifies pending Reap post statuses", () => {
  assert.equal(isReapPostPending(makePost({ status: "processing" })), true);
  assert.equal(isReapPostPending(makePost({ status: "draft" })), true);
  assert.equal(isReapPostPending(makePost({ status: "completed", successPlatforms: ["tiktok"] })), false);
});
