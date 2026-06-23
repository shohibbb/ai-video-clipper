import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { upsertSocialAccount } from "@/lib/composio/accounts";

export const runtime = "nodejs";

function getComposioBaseUrl(): string {
  return process.env.COMPOSIO_BASE_URL ?? "https://backend.composio.dev";
}

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  const body = (await request.json().catch(() => ({}))) ?? {};
  const entityId = (body.entityId as string) || user.id;

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Composio API key not configured." },
      { status: 500 },
    );
  }

  const baseUrl = getComposioBaseUrl();

  try {
    // Fetch Instagram user info via the unique entity (or fallback to user.id)
    const igRes = await fetch(
      `${baseUrl}/api/v3/tools/execute/INSTAGRAM_GET_USER_INFO`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: entityId,
          arguments: { ig_user_id: "me" },
        }),
      },
    );

    if (!igRes.ok) {
      const text = await igRes.text();
      console.error("Composio INSTAGRAM_GET_USER_INFO error:", text);
      return NextResponse.json({
        success: false,
        status: "pending",
        message:
          "Instagram connection not yet active. Please complete the authorization in the popup window.",
      });
    }

    const igData = (await igRes.json()) as {
      data?: { id?: string; username?: string };
      successful?: boolean;
    };

    if (!igData.successful) {
      return NextResponse.json({
        success: false,
        status: "pending",
        message:
          "Could not retrieve Instagram account info. Complete the authorization first.",
      });
    }

    const igUserId = igData.data?.id ?? "";
    const igUsername = igData.data?.username ?? "";
    if (!igUserId || !igUsername) {
      return NextResponse.json({
        success: false,
        status: "pending",
        message: "Instagram account info is incomplete.",
      });
    }

    // Save to database with the unique entity ID so upload uses the right connection
    const account = await upsertSocialAccount({
      userId: user.id,
      platform: "instagram",
      connectedId: entityId,
      igUserId,
      igUsername,
    });

    return NextResponse.json({
      success: true,
      socialAccounts: [
        {
          id: account.id,
          igUsername: account.igUsername,
          igUserId: account.igUserId,
          alias: account.alias,
        },
      ],
    });
  } catch (error) {
    console.error("Instagram sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed." },
      { status: 500 },
    );
  }
}
