"use client";

import { useEffect, useState, type ReactNode } from "react";
import PlaidLink from "./PlaidLink";
import { showToast } from "./Toast";

interface BankAccount {
  id: string;
  name: string;
  type: string;
  mask?: string;
}

interface BankingSectionProps {
  onSyncComplete?: () => void;
}

function BankingSectionShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
      {children}
    </div>
  );
}

export default function BankingSection({ onSyncComplete }: BankingSectionProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importCount, setImportCount] = useState<number | null>(null);

  // Fetch userId on mount - auto-bootstrap if needed
  useEffect(() => {
    async function fetchUserId() {
      try {
        let response = await fetch("/api/me");

        // If 401, bootstrap a new session
        if (response.status === 401) {
          console.log("No session found, bootstrapping...");
          const bootstrapResponse = await fetch("/api/main/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });

          if (bootstrapResponse.ok) {
            // Try fetching userId again
            response = await fetch("/api/me");
          }
        }

        if (response.ok) {
          const data = await response.json();
          setUserId(data.userId);
        }
      } catch (err) {
        console.error("Error fetching user ID:", err);
      } finally {
        setReady(true);
      }
    }
    fetchUserId();
  }, []);

  const loadAccounts = async () => {
    if (!userId) return;
    try {
      const response = await fetch("/api/plaid/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (err: unknown) {
      console.error("Error loading accounts:", err);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [userId]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setImportCount(null);

    try {
      const response = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: getStartDate(),
          endDate: getTodayDate(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync");
      }

      const data = await response.json();
      setLastSynced(new Date().toLocaleTimeString("en-GB"));
      setImportCount(data.imported);

      if (data.imported > 0) {
        showToast(`Imported ${data.imported} new transaction(s)`, "success");
      } else {
        showToast("No new transactions to import", "info");
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast(msg || "Failed to sync transactions", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleBankConnected = () => {
    loadAccounts();
    setError(null);
    showToast("Bank account connected successfully", "success");
  };

  if (!ready) {
    return (
      <BankingSectionShell>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bank Sync</div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      </BankingSectionShell>
    );
  }

  if (!userId) {
    return (
      <BankingSectionShell>
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bank Sync</div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Sign in to connect your bank and sync transactions automatically.
        </p>
      </BankingSectionShell>
    );
  }

  const connectButton = <PlaidLink userId={userId} onSuccess={handleBankConnected} />;

  return (
    <BankingSectionShell>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bank Sync</div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Connect your bank to automatically import transactions
      </p>

      <div className="mt-4 space-y-4">
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">No bank accounts connected</p>
            <div className="mt-3">
              {connectButton}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{account.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {account.type}
                      {account.mask ? ` •••• ${account.mask}` : ""}
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
                </div>
              ))}
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="vn-btn vn-btn-primary w-full text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={syncing ? "Syncing transactions" : "Sync transactions from bank"}
            >
              {syncing ? "Syncing..." : "Sync Transactions"}
            </button>

            {importCount !== null && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 dark:border-amber-400/30 dark:bg-amber-900/20 p-3">
                <p className="text-sm text-slate-800 dark:text-amber-100">
                  ✓ Imported {importCount} new transaction{importCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {lastSynced && (
              <div className="text-xs text-slate-500 dark:text-slate-400">Last synced: {lastSynced}</div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              {connectButton}
            </div>
          </>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-400/40 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            {error.includes("No bank accounts connected") && (
              <div className="mt-2">
                {connectButton}
              </div>
            )}
          </div>
        )}
      </div>
    </BankingSectionShell>
  );
}

function getStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 90); // Last 90 days
  return date.toISOString().split("T")[0];
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}
