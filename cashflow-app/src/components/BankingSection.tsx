"use client";

import { useEffect, useState } from "react";
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

export default function BankingSection({ onSyncComplete }: BankingSectionProps) {
  const [userId, setUserId] = useState<string | null>(null);
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
    } catch (err: any) {
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
    } catch (err: any) {
      setError(err.message);
      showToast(err.message || "Failed to sync transactions", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleBankConnected = () => {
    loadAccounts();
    setError(null);
    showToast("Bank account connected successfully", "success");
  };

  if (!userId) {
    return (
      <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
        <div className="text-sm font-semibold text-slate-800">Bank Sync</div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
      <div className="text-sm font-semibold text-slate-800">Bank Sync</div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Connect your bank to automatically import transactions
      </p>

      <div className="mt-4 space-y-4">
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">No bank accounts connected</p>
            <div className="mt-3">
              <PlaidLink userId={userId} onSuccess={handleBankConnected} />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{account.name}</div>
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
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              aria-label={syncing ? "Syncing transactions" : "Sync transactions from bank"}
            >
              {syncing ? "Syncing..." : "Sync Transactions"}
            </button>

            {importCount !== null && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-slate-800">
                  ✓ Imported {importCount} new transaction{importCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {lastSynced && (
              <div className="text-xs text-slate-500 dark:text-slate-400">Last synced: {lastSynced}</div>
            )}

            <div className="pt-2 border-t border-slate-200">
              <PlaidLink userId={userId} onSuccess={handleBankConnected} />
            </div>
          </>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
            {error.includes("No bank accounts connected") && (
              <div className="mt-2">
                <PlaidLink userId={userId} onSuccess={handleBankConnected} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
