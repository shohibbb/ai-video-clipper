import { prisma } from "@/lib/prisma";

export type SocialAccountRecord = {
  id: string;
  userId: string;
  platform: string;
  connectedId: string;
  igUserId: string;
  igUsername: string;
  alias: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Get all active Instagram accounts for a user
 */
export async function getInstagramAccounts(
  userId: string,
): Promise<SocialAccountRecord[]> {
  return prisma.socialAccount.findMany({
    where: {
      userId,
      platform: "instagram",
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single social account by ID
 */
export async function getSocialAccountById(
  id: string,
  userId: string,
): Promise<SocialAccountRecord | null> {
  return prisma.socialAccount.findFirst({
    where: {
      id,
      userId,
      isActive: true,
    },
  });
}

/**
 * Create or update a social account after OAuth connection
 */
export async function upsertSocialAccount(data: {
  userId: string;
  platform: string;
  connectedId: string;
  igUserId: string;
  igUsername: string;
  alias?: string;
}): Promise<SocialAccountRecord> {
  return prisma.socialAccount.upsert({
    where: {
      userId_connectedId: {
        userId: data.userId,
        connectedId: data.connectedId,
      },
    },
    create: {
      userId: data.userId,
      platform: data.platform,
      connectedId: data.connectedId,
      igUserId: data.igUserId,
      igUsername: data.igUsername,
      alias: data.alias ?? null,
      isActive: true,
    },
    update: {
      igUserId: data.igUserId,
      igUsername: data.igUsername,
      alias: data.alias ?? undefined,
      isActive: true,
      updatedAt: new Date(),
    },
  });
}

/**
 * Soft delete a social account
 */
export async function deactivateSocialAccount(
  id: string,
  userId: string,
): Promise<void> {
  await prisma.socialAccount.updateMany({
    where: {
      id,
      userId,
    },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });
}
