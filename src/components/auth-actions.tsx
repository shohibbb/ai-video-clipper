"use client";

import { signIn, signOut } from "next-auth/react";

type AuthProvider = {
  id: "google" | "github";
  label: string;
  enabled: boolean;
};

type AuthButtonsProps = {
  providers: AuthProvider[];
  callbackUrl?: string;
};

export function AuthButtons({ providers, callbackUrl = "/dashboard" }: AuthButtonsProps) {
  const enabledProviders = providers.filter((provider) => provider.enabled);

  if (!enabledProviders.length) {
    return (
      <div className="rounded-xl border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] p-4 text-sm font-bold leading-6 text-[#ffb4ab]">
        No OAuth provider is configured. You can still sign in with email and password.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {enabledProviders.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => void signIn(provider.id, { callbackUrl })}
          suppressHydrationWarning
          className="inline-flex h-12 items-center justify-center rounded-lg bg-[#d3f000] px-5 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.18em] text-[#2c3400] transition hover:-translate-y-0.5 hover:bg-[#39ff14] active:scale-[0.98]"
        >
          Continue with {provider.label}
        </button>
      ))}
    </div>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      suppressHydrationWarning
      className="inline-flex min-h-0 items-center justify-center rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-3 py-2 font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase leading-4 tracking-[0.18em] text-[#c6c9ab] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.42)] hover:text-[#dffe00]"
    >
      Sign out
    </button>
  );
}
