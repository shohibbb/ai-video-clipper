"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type InstagramAccount = {
  id: string;
  igUsername: string;
  igUserId: string;
  alias: string | null;
};

type InstagramAccountSelectorProps = {
  selectedAccountId: string | null;
  onSelect: (accountId: string | null) => void;
  clipId: string;
};

export function InstagramAccountSelector({
  selectedAccountId,
  onSelect,
  clipId,
}: InstagramAccountSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      setLoading(true);
      const res = await fetch("/api/composio/instagram/accounts");
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);

      // Auto-select first account if none selected
      if (!selectedAccountId && data.accounts?.length > 0) {
        onSelect(data.accounts[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }

  async function connectNewAccount() {
    setIsConnecting(true);
    setError("");

    try {
      const res = await fetch("/api/composio/instagram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate connection");
      }

      const data = await res.json();

      if (data.redirectUrl) {
        // Open Composio OAuth in new tab
        window.open(data.redirectUrl, "_blank");

        // Poll for new accounts after a delay
        setTimeout(() => {
          fetchAccounts();
        }, 5000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect account");
    } finally {
      setIsConnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#c6c9ab]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#dffe00] border-t-transparent" />
        Loading accounts...
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <label className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase leading-4 tracking-[0.25em] text-[#dffe00]">
        Instagram Account
      </label>

      {accounts.length > 0 ? (
        <select
          title="Select Instagram account"
          value={selectedAccountId || ""}
          onChange={(e) => onSelect(e.target.value || null)}
          className="min-h-10 w-full rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-3 py-2 text-sm text-[#e2e2e1] focus:border-[#dffe00] focus:outline-none"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              @{acc.igUsername}
              {acc.alias ? ` (${acc.alias})` : ""}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-[#c6c9ab]">
          No Instagram accounts connected yet.
        </p>
      )}

      <button
        type="button"
        onClick={connectNewAccount}
        disabled={isConnecting}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[rgba(223,254,0,0.30)] bg-[rgba(30,32,32,0.70)] px-4 py-2 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-[#dffe00] transition hover:-translate-y-0.5 hover:border-[rgba(223,254,0,0.60)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isConnecting ? "Connecting..." : "+ Connect New Account"}
      </button>

      {error ? (
        <p className="rounded-lg border border-[#ffb4ab] bg-[rgba(255,180,171,0.10)] px-3 py-2 text-xs font-bold text-[#ffb4ab]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
