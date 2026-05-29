import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function getEnv(firstName: string, fallbackName?: string) {
  return process.env[firstName] || (fallbackName ? process.env[fallbackName] : undefined);
}

function getProviders() {
  const providers: NextAuthOptions["providers"] = [];
  const googleClientId = getEnv("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnv("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET");
  const githubClientId = getEnv("AUTH_GITHUB_ID", "GITHUB_ID");
  const githubClientSecret = getEnv("AUTH_GITHUB_SECRET", "GITHUB_SECRET");

  if (googleClientId && googleClientSecret) {
    providers.push(
      GoogleProvider({
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      }),
    );
  }

  if (githubClientId && githubClientSecret) {
    providers.push(
      GitHubProvider({
        clientId: githubClientId,
        clientSecret: githubClientSecret,
      }),
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers: getProviders(),
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email);
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
};
