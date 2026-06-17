import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { getInstagramAccounts } from "@/lib/composio/accounts";

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
