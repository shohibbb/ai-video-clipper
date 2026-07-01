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

export async function uploadInstagramReels(
  options: InstagramUploadOptions,
): Promise<InstagramUploadResult> {
  const {
    entityId,
    igUserId,
    videoUrl,
    caption = "",
    shareToFeed = true,
  } = options;

  const apiKey = process.env.COMPOSIO_API_KEY;

  if (!apiKey) {
    return { success: false, error: "COMPOSIO_API_KEY is not configured" };
  }

  try {
    // Step 1: Create media container
    let creationId = "";

    const createRes = await fetch(
      "https://backend.composio.dev/api/v2/tools/INSTAGRAM_POST_IG_USER_MEDIA/execute",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ig_user_id: igUserId,
          video_url: videoUrl,
          media_type: "REELS",
          caption,
          share_to_feed: shareToFeed,
        }),
      },
    );

    if (!createRes.ok) {
      const text = await createRes.text();
      return {
        success: false,
        error: `Failed to create media container (${createRes.status}): ${text.slice(0, 200)}`,
      };
    }

    const createData = await createRes.json();
    creationId = createData?.data?.id ?? createData?.id ?? "";

    if (!creationId) {
      return {
        success: false,
        error: "No container ID returned from Instagram media creation",
      };
    }

    // Step 2: Publish the container
    const publishRes = await fetch(
      "https://backend.composio.dev/api/v2/tools/INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH/execute",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ig_user_id: igUserId,
          creation_id: creationId,
          max_wait_seconds: 300,
        }),
      },
    );

    if (!publishRes.ok) {
      const text = await publishRes.text();
      return {
        success: false,
        error: `Failed to publish media (${publishRes.status}): ${text.slice(0, 200)}`,
        containerId: creationId,
      };
    }

    const publishData = await publishRes.json();
    const mediaId = publishData?.data?.id ?? "";

    return {
      success: true,
      containerId: creationId,
      mediaId,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during Instagram upload",
    };
  }
}
