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
  selectedAccountIds: string[];
  onSelect: (accountIds: string[]) => void;
  clipId: string;
};

export function InstagramAccountSelector({
  selectedAccountIds,
  onSelect,
  clipId,
}: InstagramAccountSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

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

      if (!data.redirectUrl) {
        throw new Error("No redirect URL returned from connection flow");
      }

      const popup = window.open(
        data.redirectUrl,
        "instagram-oauth",
        "width=600,height=700",
      );

      if (!popup) {
        throw new Error(
          "Popup was blocked. Please allow popups and try again.",
        );
      }

      setIsConnecting(false);

      const checkPopup = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkPopup);
          await syncAccount(data.entityId);
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || "Failed to connect account");
      setIsConnecting(false);
    }
  }

  async function syncAccount(entityId?: string) {
    setError("");

    try {
      const res = await fetch("/api/composio/instagram/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      });

      const data = await res.json();

      if (data.status === "pending") {
        setError(
          "Authorization still pending. Please try again in a moment.",
        );
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed");
      }

      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to sync account");
    }
  }

  async function disconnectAccount(accountId: string, username: string) {
    if (!confirm(`Disconnect @${username} from Instagram?`)) return;

    setDisconnectingId(accountId);
    setError("");

    try {
      const res = await fetch(`/api/composio/instagram/accounts?id=${accountId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect account");
      }

      // Remove from selection if it was selected
      if (selectedAccountIds.includes(accountId)) {
        onSelect(selectedAccountIds.filter((id) => id !== accountId));
      }

      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || "Failed to disconnect account");
    } finally {
      setDisconnectingId(null);
    }
  }

  function toggleAccount(accountId: string) {
    if (selectedAccountIds.includes(accountId)) {
      onSelect(selectedAccountIds.filter((id) => id !== accountId));
    } else {
      onSelect([...selectedAccountIds, accountId]);
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
        Instagram Accounts
      </label>

      {accounts.length > 0 ? (
        <div className="grid gap-1">
          {accounts.map((acc) => (
            <label
              key={acc.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[rgba(223,254,0,0.15)] bg-[rgba(30,32,32,0.70)] px-3 py-2 text-sm text-[#e2e2e1] transition hover:border-[rgba(223,254,0,0.40)]"
            >
              <input
                type="checkbox"
                checked={selectedAccountIds.includes(acc.id)}
                onChange={() => toggleAccount(acc.id)}
                className="h-4 w-4 accent-[#dffe00]"
              />
              <span className="flex-1">
                @{acc.igUsername}
                {acc.alias ? ` (${acc.alias})` : ""}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  disconnectAccount(acc.id, acc.igUsername);
                }}
                disabled={disconnectingId === acc.id}
                className="ml-auto text-xs text-[#ffb4ab] transition hover:text-[#ff8a82] disabled:opacity-50"
              >
                {disconnectingId === acc.id ? "..." : "Disconnect"}
              </button>
            </label>
          ))}
        </div>
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
