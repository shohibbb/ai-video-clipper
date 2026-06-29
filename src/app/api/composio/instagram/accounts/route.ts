import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getInstagramAccounts, deactivateSocialAccount, getSocialAccountById } from "@/lib/composio/accounts";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireCurrentUser();

  const accounts = await getInstagramAccounts(user.id);

  return NextResponse.json({
    accounts: accounts.map((acc) => ({
      id: acc.id,
      platform: acc.platform,
      igUsername: acc.igUsername,
      igUserId: acc.igUserId,
      alias: acc.alias,
      isActive: acc.isActive,
      createdAt: acc.createdAt.toISOString(),
    })),
  });
}

export async function DELETE(request: Request) {
  const user = await requireCurrentUser();

  // Parse ID from URL: /api/composio/instagram/accounts?id=xxx
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing account id" }, { status: 400 });
  }

  const account = await getSocialAccountById(id, user.id);
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await deactivateSocialAccount(id, user.id);

  return NextResponse.json({ success: true });
}
