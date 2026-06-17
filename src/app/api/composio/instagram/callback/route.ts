import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertSocialAccount } from "@/lib/composio/accounts";

export const runtime = "nodejs";

const COMPOSIO_BASE_URL = "https://backend.composio.dev";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const alias = searchParams.get("alias");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const connectedAccountId = searchParams.get("connected_account_id");

  if (!userId) {
    return NextResponse.redirect(
      new URL("/videos?error=missing-user-id", request.url),
    );
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.redirect(
      new URL("/videos?error=composio-not-configured", request.url),
    );
  }

  try {
    // If we have a connected_account_id, fetch the connection details
    let finalConnectedId = connectedAccountId;

    if (!finalConnectedId && code) {
      // Try to exchange code for connection
      const tokenResponse = await fetch(
        `${COMPOSIO_BASE_URL}/api/v3/connections/exchange-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            code,
            toolkit: "instagram",
            user_id: userId,
          }),
        },
      );

      if (tokenResponse.ok) {
        const tokenData = (await tokenResponse.json()) as {
          connected_account_id?: string;
        };
        finalConnectedId = tokenData.connected_account_id ?? null;
      }
    }

    if (!finalConnectedId) {
      return NextResponse.redirect(
        new URL("/videos?error=no-connected-account", request.url),
      );
    }

    // Fetch Instagram user info using Composio REST API
    const igUserInfoResponse = await fetch(
      `${COMPOSIO_BASE_URL}/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          arguments: { ig_user_id: "me" },
          user_id: userId,
        }),
      },
    );

    let igUserId = "";
    let igUsername = "";

    if (igUserInfoResponse.ok) {
      const igData = (await igUserInfoResponse.json()) as {
        data?: { id?: string; username?: string };
      };
      igUserId = igData.data?.id ?? "";
      igUsername = igData.data?.username ?? "";
    }

    // Save to database
    await upsertSocialAccount({
      userId,
      platform: "instagram",
      connectedId: finalConnectedId,
      igUserId: igUserId || "unknown",
      igUsername: igUsername || "unknown",
      alias: alias ?? undefined,
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL("/videos?instagram=connected", request.url),
    );
  } catch (error) {
    console.error("Instagram callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/videos?error=${encodeURIComponent(error instanceof Error ? error.message : "callback-failed")}`,
        request.url,
      ),
    );
  }
}
