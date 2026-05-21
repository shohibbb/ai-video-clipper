-- AlterEnum: rename VideoStatus values
ALTER TYPE "VideoStatus" RENAME VALUE 'uploading_to_opusclip' TO 'uploading_to_reap';
ALTER TYPE "VideoStatus" RENAME VALUE 'processing_in_opusclip' TO 'processing_in_reap';
ALTER TYPE "VideoStatus" RENAME VALUE 'downloading_clips' TO 'downloading_from_reap';

-- AlterEnum: rename JobType values
ALTER TYPE "JobType" RENAME VALUE 'opusclip_process' TO 'reap_process';
ALTER TYPE "JobType" RENAME VALUE 'upload_tiktok' TO 'reap_publish';

-- AlterEnum: add publishing to UploadStatus
ALTER TYPE "UploadStatus" ADD VALUE 'publishing';

-- Video: add reapProjectId column
ALTER TABLE "videos" ADD COLUMN "reap_project_id" TEXT;
CREATE INDEX "videos_reap_project_id_idx" ON "videos"("reap_project_id");

-- Clip: rename opusclipClipId to reapClipId, add new columns
ALTER TABLE "clips" RENAME COLUMN "opusclip_clip_id" TO "reap_clip_id";
ALTER TABLE "clips" ADD COLUMN "virality_score" DOUBLE PRECISION;
ALTER TABLE "clips" ADD COLUMN "source_start_time" DOUBLE PRECISION;
ALTER TABLE "clips" ADD COLUMN "source_end_time" DOUBLE PRECISION;
CREATE INDEX "clips_reap_clip_id_idx" ON "clips"("reap_clip_id");

-- UploadTarget: add Reap fields
ALTER TABLE "upload_targets" ADD COLUMN "reap_integration_id" TEXT;
ALTER TABLE "upload_targets" ADD COLUMN "reap_post_id" TEXT;