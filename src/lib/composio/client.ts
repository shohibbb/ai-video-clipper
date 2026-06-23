import type { ComposioExecuteActionResponse } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Environment variable ${name} is required for Composio operations.`,
    );
  }
  return value;
}

export type ComposioClientConfig = {
  apiKey: string;
  baseUrl?: string;
};

export class ComposioClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config?: Partial<ComposioClientConfig>) {
    this.apiKey = config?.apiKey ?? requireEnv("COMPOSIO_API_KEY");
    this.baseUrl = config?.baseUrl ?? process.env.COMPOSIO_BASE_URL ?? "https://backend.composio.dev";
  }

  async executeAction(
    actionName: string,
    entityId: string,
    input: Record<string, unknown>,
  ): Promise<ComposioExecuteActionResponse> {
    const url = `${this.baseUrl}/api/v3/tools/execute/${actionName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        arguments: input,
        user_id: entityId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Composio API error ${response.status} for action "${actionName}": ${errorBody}`,
      );
    }

    const result = (await response.json()) as ComposioExecuteActionResponse;
    return result;
  }

  async createInstagramMediaContainer(
    entityId: string,
    igUserId: string,
    videoUrl: string,
    caption: string,
    shareToFeed = true,
  ): Promise<ComposioExecuteActionResponse> {
    // v3 API slug for creating media container
    return this.executeAction("INSTAGRAM_POST_IG_USER_MEDIA", entityId, {
      ig_user_id: igUserId,
      video_url: videoUrl,
      media_type: "REELS",
      caption,
      share_to_feed: shareToFeed,
    });
  }

  async publishInstagramMediaContainer(
    entityId: string,
    igUserId: string,
    creationId: string,
    maxWaitSeconds = 300,
  ): Promise<ComposioExecuteActionResponse> {
    return this.executeAction(
      "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH",
      entityId,
      {
        ig_user_id: igUserId,
        creation_id: creationId,
        max_wait_seconds: maxWaitSeconds,
      },
    );
  }
}

// Singleton getter
let globalClient: ComposioClient | null = null;

export function getComposioClient(): ComposioClient {
  globalClient ??= new ComposioClient();
  return globalClient;
}
