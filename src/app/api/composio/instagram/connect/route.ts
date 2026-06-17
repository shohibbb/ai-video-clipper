import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const COMPOSIO_BASE_URL = "https://backend.composio.dev";

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  const body = (await request.json().catch(() => ({}))) ?? {};
  const alias = body.alias as string | undefined;

  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "COMPOSIO_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    // Use Composio v3 API to initiate Instagram connection
    const response = await fetch(
      `${COMPOSIO_BASE_URL}/api/v3/connections/initiate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          toolkit: "instagram",
          user_id: user.id,
          redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/composio/instagram/callback?userId=${user.id}${alias ? `&alias=${encodeURIComponent(alias)}` : ""}`,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Composio connection init error:", errorBody);
      return NextResponse.json(
        { error: `Failed to initiate connection: ${response.status}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      redirect_url?: string;
      connected_account_id?: string;
    };

    if (!data.redirect_url) {
      return NextResponse.json(
        { error: "No redirect URL returned from Composio." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      redirectUrl: data.redirect_url,
      connectedAccountId: data.connected_account_id,
    });
  } catch (error) {
    console.error("Composio connect error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initiate Instagram connection.",
      },
      { status: 500 },
    );
  }
}
