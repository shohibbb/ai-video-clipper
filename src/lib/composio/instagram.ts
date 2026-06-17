import { spawn } from "child_process";
import path from "path";

export type InstagramUploadOptions = {
  entityId: string;
  igUserId: string;
  videoUrl: string;
  caption?: string;
  shareToFeed?: boolean;
};

export type InstagramUploadResult = {
  success: boolean;
  containerId?: string;
  mediaId?: string;
  error?: string;
};

/**
 * Upload a video to Instagram Reels via Composio Python SDK.
 *
 * Instagram's publish action (INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH) is only
 * available through the Composio Python SDK, not the v3 REST API. This function
 * spawns the Python SDK script as a child process.
 */
export async function uploadToInstagramReels(
  options: InstagramUploadOptions,
): Promise<InstagramUploadResult> {
  const {
    entityId,
    igUserId,
    videoUrl,
    caption = "",
    shareToFeed = true,
  } = options;

  const scriptPath = path.join(process.cwd(), "scripts", "instagram-upload.py");

  const args = JSON.stringify({
    entity_id: entityId,
    ig_user_id: igUserId,
    video_url: videoUrl,
    caption,
    share_to_feed: shareToFeed,
  });

  return new Promise<InstagramUploadResult>((resolve) => {
    const child = spawn("python", [scriptPath, args], {
      env: {
        ...process.env,
        COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY ?? "",
      },
      timeout: 300_000, // 5 minutes max (video processing can be slow)
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: stderr.trim() || `Python script exited with code ${code}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve(result as InstagramUploadResult);
      } catch {
        resolve({
          success: false,
          error: `Failed to parse Python script output: ${stdout.trim().slice(0, 200)}`,
        });
      }
    });

    child.on("error", (err) => {
      resolve({
        success: false,
        error: `Failed to spawn Python process: ${err.message}`,
      });
    });
  });
}
