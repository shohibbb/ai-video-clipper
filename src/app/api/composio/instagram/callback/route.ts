import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertSocialAccount } from "@/lib/composio/accounts";

export const runtime = "nodejs";

function getComposioBaseUrl(): string {
  return process.env.COMPOSIO_BASE_URL ?? "https://backend.composio.dev";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const connectionId = searchParams.get("connectionId");

  if (!userId) {
    return NextResponse.redirect(
      new URL("/videos?error=missing-user-id", request.url),
    );
  }

  if (!connectionId) {
    return NextResponse.redirect(
      new URL("/videos?error=no-connection-id", request.url),
    );
  }

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.redirect(
      new URL("/videos?error=composio-not-configured", request.url),
    );
  }

  try {
    // Fetch connection details from Composio
    const connResponse = await fetch(
      `${getComposioBaseUrl()}/api/v3/connections/${connectionId}`,
      {
        headers: { "x-api-key": apiKey },
      },
    );

    if (!connResponse.ok) {
      const text = await connResponse.text();
      console.error("Composio get connection error:", text);
      return NextResponse.redirect(
        new URL("/videos?error=connection-not-found", request.url),
      );
    }

    const connData = (await connResponse.json()) as {
      id?: string;
      status?: string;
      toolkit?: { slug?: string };
    };

    if (!connData.id) {
      return NextResponse.redirect(
        new URL("/videos?error=connection-not-active", request.url),
      );
    }

    const connectedId = connData.id;

    // Fetch Instagram user info
    const igInfoResponse = await fetch(
      `${getComposioBaseUrl()}/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: userId,
          arguments: {},
        }),
      },
    );

    let igUserId = "";
    let igUsername = "";

    if (igInfoResponse.ok) {
      const igData = (await igInfoResponse.json()) as {
        data?: { id?: string; username?: string };
      };
      igUserId = igData.data?.id ?? "";
      igUsername = igData.data?.username ?? "";
    }

    // Save to database
    await upsertSocialAccount({
      userId,
      platform: "instagram",
      connectedId,
      igUserId: igUserId || "unknown",
      igUsername: igUsername || "unknown",
    });

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
