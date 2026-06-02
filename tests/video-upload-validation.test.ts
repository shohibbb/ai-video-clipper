import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedVideoFileMetadata } from "../src/lib/api/validation";

test("accepts supported video file metadata", () => {
  assert.equal(isAllowedVideoFileMetadata("source.mp4", "video/mp4"), true);
  assert.equal(isAllowedVideoFileMetadata("source.mov", "video/quicktime"), true);
  assert.equal(isAllowedVideoFileMetadata("source.webm", "video/webm"), true);
});

test("rejects unsupported video file metadata", () => {
  assert.equal(isAllowedVideoFileMetadata("source.exe", "video/mp4"), false);
  assert.equal(isAllowedVideoFileMetadata("source.mp4", "application/octet-stream"), false);
});
