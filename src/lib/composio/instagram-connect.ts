export type InstagramConnectOptions = {
  userId: string;
  redirectUrl: string;
};

export type InstagramConnectResult = {
  success: boolean;
  redirectUrl?: string;
  connectedAccountId?: string;
  status?: string;
  instagramMetadata?: {
    ig_user_id?: string;
    username?: string;
  };
  error?: string;
};

export async function connectInstagram(
  options: InstagramConnectOptions,
): Promise<InstagramConnectResult> {
  const { userId, redirectUrl } = options;

  const apiKey = process.env.COMPOSIO_API_KEY;
  const authConfigId = process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID;

  if (!apiKey) {
    return { success: false, error: "COMPOSIO_API_KEY is not configured" };
  }
  if (!authConfigId) {
    return {
      success: false,
      error: "COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID is not configured",
    };
  }

  try {
    const response = await fetch(
      "https://backend.composio.dev/api/v3/connected_accounts/link",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          auth_config_id: authConfigId,
          allow_multiple: true,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Composio link failed (${response.status}): ${text.slice(0, 200)}`,
      };
    }

    const data = await response.json();

    const redirectUrlValue =
      data.redirect_url ?? data.redirectUrl ?? data.redirectURL ?? "";

    const connectedAccountId =
      data.connected_account_id ??
      data.id ??
      data.connectedAccountId ??
      undefined;

    const connectionStatus = (data.status ?? "").toUpperCase();

    let igUserId = "";
    let igUsername = "";

    if (connectionStatus === "ACTIVE" && connectedAccountId) {
      try {
        const userInfoRes = await fetch(
          "https://backend.composio.dev/api/v2/tools/INSTAGRAM_GET_USER_INFO/execute",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ user_id: userId }),
          },
        );

        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json();
          const userData = userInfo.data ?? {};
          igUserId = userData.id ?? "";
          igUsername = userData.username ?? "";
        }
      } catch {
        // ignore metadata fetch; connection itself is enough
      }
    }

    return {
      success: true,
      redirectUrl: redirectUrlValue,
      connectedAccountId: connectedAccountId ?? undefined,
      status: connectionStatus,
      instagramMetadata: {
        ig_user_id: igUserId,
        username: igUsername,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown error during connect",
    };
  }
}
