import assert from "node:assert/strict";
import test from "node:test";
import {
  getVideoProcessingProgress,
  isVideoProcessingStatus,
  videoProcessingStages,
} from "../src/lib/video-processing-progress";
import {
  getYouTubeThumbnailUrl,
  getYouTubeVideoId,
  isDirectVideoUrl,
} from "../src/lib/video-source-preview";

test("maps active video statuses to ordered workflow progress", () => {
  const values = videoProcessingStages.map((stage) => {
    const progress = getVideoProcessingProgress(stage.status);
    assert.ok(progress);
    return progress.progress;
  });

  assert.deepEqual(values, [...values].sort((left, right) => left - right));
  assert.equal(getVideoProcessingProgress("processing_in_reap")?.stageNumber, 3);
  assert.equal(getVideoProcessingProgress("ready_to_upload"), null);
});

test("identifies only active clipping statuses", () => {
  assert.equal(isVideoProcessingStatus("queued"), true);
  assert.equal(isVideoProcessingStatus("storing_clips"), true);
  assert.equal(isVideoProcessingStatus("failed"), false);
  assert.equal(isVideoProcessingStatus("completed"), false);
});

test("builds previews for supported YouTube and direct video URLs", () => {
  assert.equal(
    getYouTubeVideoId("https://www.youtube.com/watch?v=abc123"),
    "abc123",
  );
  assert.equal(
    getYouTubeVideoId("https://youtu.be/xyz987?t=12"),
    "xyz987",
  );
  assert.equal(
    getYouTubeThumbnailUrl("https://www.youtube.com/shorts/clip456"),
    "https://i.ytimg.com/vi/clip456/hqdefault.jpg",
  );
  assert.equal(isDirectVideoUrl("https://cdn.example.com/source.webm?token=1"), true);
  assert.equal(isDirectVideoUrl("https://example.com/watch/video"), false);
});
