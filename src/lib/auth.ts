import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const fallbackDevUserId = "00000000-0000-0000-0000-000000000001";
const fallbackDevUserEmail = "dev@example.com";

function isDevAuthAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH === "true";
}

async function getDevUser() {
  const id = process.env.DEV_USER_ID ?? fallbackDevUserId;
  const email = process.env.DEV_USER_EMAIL ?? fallbackDevUserEmail;

  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id,
      email,
      name: "Local MVP User",
    },
  });
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (sessionUserId) {
    return prisma.user.findUnique({
      where: {
        id: sessionUserId,
      },
    });
  }

  if (isDevAuthAllowed()) {
    return getDevUser();
  }

  return null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (user) {
    return user;
  }

  redirect("/api/auth/signin");
}
