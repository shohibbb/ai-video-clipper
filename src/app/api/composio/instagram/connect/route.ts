import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { connectInstagram } from "@/lib/composio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await requireCurrentUser();
  const body = (await request.json().catch(() => ({}))) ?? {};
  const alias = body.alias as string | undefined;

  // Unique entity per IG account so upload always uses the right connection
  const entityId = `${user.id}-ig-${Date.now()}`;

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/composio/instagram/callback?userId=${user.id}`;

  const result = await connectInstagram({
    userId: entityId,
    redirectUrl,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to initiate connection." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    redirectUrl: result.redirectUrl,
    connectedAccountId: result.connectedAccountId,
    entityId,
  });
}
