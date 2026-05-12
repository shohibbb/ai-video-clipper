import { Composio } from "@composio/core";
import type { FileUploadData, ToolExecuteParams, ToolExecuteResponse } from "@composio/core";
import { getComposioTikTokConfig, requireComposioApiKey } from "@/lib/composio/config";

export type TikTokUploadInput = {
  userId: string;
  clipId: string;
  uploadTargetId: string;
  fileUrl: string;
  storagePath: string;
  title?: string | null;
  caption?: string | null;
  hashtags?: string[];
};

export type TikTokUploadResult = {
  uploadedUrl: string | null;
  platformResponse: ToolExecuteResponse;
  fileUpload: FileUploadData;
};

function buildCaption({ title, caption, hashtags }: Pick<TikTokUploadInput, "title" | "caption" | "hashtags">) {
  const hashtagLine = hashtags?.length ? hashtags.join(" ") : "";

  return [title, caption, hashtagLine]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2200);
}

function buildToolkitVersions(toolkitVersion: string | null) {
  return toolkitVersion
    ? {
        tiktok: toolkitVersion,
      }
    : undefined;
}

function isUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function extractUploadedUrl(value: unknown, depth = 0): string | null {
  if (depth > 5 || value == null) {
    return null;
  }

  if (isUrl(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedUrl = extractUploadedUrl(item, depth + 1);

      if (nestedUrl) {
        return nestedUrl;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const urlKeys = ["uploadedUrl", "uploaded_url", "shareUrl", "share_url", "videoUrl", "video_url", "postUrl", "post_url", "permalink", "url"];

  for (const key of urlKeys) {
    if (isUrl(record[key])) {
      return record[key];
    }
  }

  for (const nestedValue of Object.values(record)) {
    const nestedUrl = extractUploadedUrl(nestedValue, depth + 1);

    if (nestedUrl) {
      return nestedUrl;
    }
  }

  return null;
}

export async function uploadClipToTikTok(input: TikTokUploadInput): Promise<TikTokUploadResult> {
  const config = getComposioTikTokConfig();
  const apiKey = requireComposioApiKey(config);
  const composio = new Composio({
    apiKey,
    toolkitVersions: buildToolkitVersions(config.toolkitVersion),
  });

  const fileUpload = await composio.files.upload({
    file: input.fileUrl,
    toolSlug: config.uploadToolSlug,
    toolkitSlug: "tiktok",
  });

  const executeParams: ToolExecuteParams = {
    userId: config.userId ?? input.userId,
    arguments: {
      caption: buildCaption(input),
      publish: config.publish,
      privacy_level: config.privacyLevel,
      disable_comment: config.disableComment,
      disable_duet: config.disableDuet,
      disable_stitch: config.disableStitch,
      file_to_upload: fileUpload,
      ...config.extraArguments,
    },
  };

  if (config.connectedAccountId) {
    executeParams.connectedAccountId = config.connectedAccountId;
  }

  const response = await composio.tools.execute(config.uploadToolSlug, executeParams);

  if (!response.successful) {
    throw new Error(response.error ?? "Composio TikTok upload failed without an error message.");
  }

  return {
    uploadedUrl: extractUploadedUrl(response.data),
    platformResponse: response,
    fileUpload,
  };
}
