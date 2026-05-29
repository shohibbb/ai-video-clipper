-- AddEnumValue
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'reap_publish_status';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clips_video_id_reap_clip_id_key"
ON "clips"("video_id", "reap_clip_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "upload_targets_reap_post_id_idx"
ON "upload_targets"("reap_post_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "upload_targets_one_active_per_clip_platform_idx"
ON "upload_targets"("clip_id", "platform")
WHERE "upload_status" IN ('queued', 'uploading', 'publishing');
