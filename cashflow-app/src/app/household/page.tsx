"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { loadPlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import { CF_JOIN_TOKEN_KEY } from "@/lib/sharingConstants";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeButton } from "@/components/ProGate";
import type { Transaction } from "@/data/plan";

// ── Icon ──────────────────────────────────────────────────────────────────
function IconHousehold({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCopy({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconActivity({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatAmount(amount: number, type: Transaction["type"]) {
  const sign = type === "income" ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(amount))}`;
}

function categoryColor(cat: Transaction["category"]) {
  const map: Record<string, string> = {
    income: "#4ade80",
    bill: "#f97316",
    giving: "#a78bfa",
    savings: "#60a5fa",
    allowance: "#fbbf24",
    buffer: "#94a3b8",
    other: "#cbd5e1",
  };
  return map[cat] ?? "#cbd5e1";
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Loading skeleton ──────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--vn-bg)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--vn-gold)] border-t-transparent animate-spin" />
        <p className="text-sm" style={{ color: "var(--vn-muted)" }}>Loading household…</p>
      </div>
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border p-5 ${className}`}
      style={{ background: "var(--vn-surface)", borderColor: "var(--vn-border)" }}
    >
      {children}
    </div>
  );
}

// ── Avatar badge ──────────────────────────────────────────────────────────
function Avatar({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold flex-shrink-0"
      style={{
        background: gold ? "var(--vn-gold)" : "rgba(168,115,26,0.22)",
        color: gold ? "#0c1626" : "var(--vn-gold)",
      }}
    >
      {label[0]?.toUpperCase()}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function HouseholdPage() {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [prevPlanTxCount, setPrevPlanTxCount] = useState<number | null>(null);
  const [currentTxCount, setCurrentTxCount] = useState<number | null>(null);

  // Sharing state
  const [joinedToken, setJoinedToken] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem(CF_JOIN_TOKEN_KEY) : null;
    setJoinedToken(token);

    const refresh = () => {
      try {
        const plan = loadPlan();
        const txns = [...(plan.transactions ?? [])].sort((a, b) => {
          const aKey = (a as Transaction & { createdAt?: string }).createdAt ?? a.date;
          const bKey = (b as Transaction & { createdAt?: string }).createdAt ?? b.date;
          return bKey.localeCompare(aKey);
        });
        setTransactions(txns.slice(0, 20));
        setCurrentTxCount(plan.transactions?.length ?? 0);

        // Check prevPlan from LocalStorage (key used by storage.ts)
        try {
          const prevRaw = window.localStorage.getItem("cashflow_prev_plan_v2");
          if (prevRaw) {
            const prev = JSON.parse(prevRaw) as { transactions?: Transaction[] };
            setPrevPlanTxCount(prev.transactions?.length ?? 0);
          }
        } catch { /* ignore */ }

        // updatedAt from MAIN_SYNC_AT_KEY
        try {
          const syncAt = window.localStorage.getItem("cashflow_main_sync_at_v1");
          if (syncAt) setUpdatedAt(parseInt(syncAt, 10));
        } catch { /* ignore */ }
      } catch { /* ignore SSR */ }
    };

    refresh();
    setReady(true);

    window.addEventListener(PLAN_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  async function generateCode() {
    setGenerating(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/shared", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { shareCode?: string; error?: string };
      if (data.shareCode) {
        setShareCode(data.shareCode);
        await navigator.clipboard.writeText(data.shareCode).catch(() => null);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setErrorMsg(data.error ?? "Could not generate code");
      }
    } catch {
      setErrorMsg("Network error – try again");
    } finally {
      setGenerating(false);
    }
  }

  async function joinWithCode() {
    if (!joinCode.trim()) return;
    setJoining(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/shared/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      const data = (await res.json()) as { joinToken?: string; error?: string };
      if (data.joinToken) {
        window.localStorage.setItem(CF_JOIN_TOKEN_KEY, data.joinToken);
        setJoinedToken(data.joinToken);
        setJoined(true);
        setJoinCode("");
      } else {
        setErrorMsg(data.error ?? "Invalid share code");
      }
    } catch {
      setErrorMsg("Network error – try again");
    } finally {
      setJoining(false);
    }
  }

  const isConnected = !!(joinedToken || shareCode);
  const hasMergeConflict =
    prevPlanTxCount !== null &&
    currentTxCount !== null &&
    prevPlanTxCount !== currentTxCount;

  const { isPro, isLoading: subLoading } = useSubscription();

  if (!ready) return <LoadingSkeleton />;

  if (!subLoading && !isPro) {
    return (
      <div className="min-h-screen pb-28 md:pb-10 flex items-center justify-center" style={{ background: "var(--vn-bg)" }}>
        <div className="max-w-sm mx-auto px-6 text-center">
          <div className="text-4xl mb-4">👨‍👩‍👧‍👦</div>
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--vn-text)" }}>Household Sharing</h1>
          <p className="text-sm mb-6" style={{ color: "var(--vn-muted)" }}>Share your cashflow with a partner or household member. View combined transactions in real time. Available on Pro.</p>
          <UpgradeButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 md:pb-10" style={{ background: "var(--vn-bg)" }}>
      <div className="max-w-2xl mx-auto px-4 pt-8">

        {/* Page title */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6 flex items-center gap-3"
        >
          <span style={{ color: "var(--vn-gold)" }}>
            <IconHousehold size={26} />
          </span>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--vn-text)" }}
          >
            Household
          </h1>
        </motion.div>

        {/* ── A. Household Status ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="mb-4"
        >
          <Card>
            {/* Status header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: isConnected ? "#4ade80" : "var(--vn-muted)" }}
                />
                <span className="font-semibold text-sm" style={{ color: "var(--vn-text)" }}>
                  {isConnected ? "Connected" : "Not connected"}
                </span>
              </div>
              {isConnected && (
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "rgba(168,115,26,0.18)", color: "var(--vn-gold)" }}
                >
                  {joinedToken ? "Shared plan" : "Your plan"}
                </span>
              )}
            </div>

            {isConnected && updatedAt && (
              <p className="text-xs mb-4" style={{ color: "var(--vn-muted)" }}>
                Last synced {timeAgo(updatedAt)}
              </p>
            )}

            {/* Share code section */}
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--vn-muted)" }}>
                Share your plan
              </p>
              {shareCode ? (
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 rounded-lg px-3 py-2 font-mono text-sm font-semibold tracking-widest border"
                    style={{ background: "var(--vn-bg)", borderColor: "var(--vn-border)", color: "var(--vn-gold)" }}
                  >
                    {shareCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareCode).catch(() => null);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "var(--vn-gold)", color: "#0c1626" }}
                    aria-label="Copy share code"
                  >
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateCode}
                  disabled={generating}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: "var(--vn-gold)", color: "#0c1626" }}
                >
                  {generating ? "Generating…" : "Generate share code"}
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="border-t my-4" style={{ borderColor: "var(--vn-border)" }} />

            {/* Join section */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--vn-muted)" }}>
                Join a partner&apos;s plan
              </p>
              {joined ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: "#4ade80" }}>
                  <IconCheck size={16} />
                  <span>Joined successfully! Reload to see shared data.</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && joinWithCode()}
                    placeholder="Enter share code"
                    maxLength={12}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-mono border outline-none focus:ring-1"
                    style={{
                      background: "var(--vn-bg)",
                      borderColor: "var(--vn-border)",
                      color: "var(--vn-text)",
                      // @ts-expect-error CSS custom properties
                      "--tw-ring-color": "var(--vn-gold)",
                    }}
                    aria-label="Share code input"
                  />
                  <button
                    onClick={joinWithCode}
                    disabled={joining || !joinCode.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ background: "rgba(168,115,26,0.22)", color: "var(--vn-gold)" }}
                  >
                    {joining ? "Joining…" : "Join"}
                  </button>
                </div>
              )}
            </div>

            {/* Error message */}
            {errorMsg && (
              <p className="mt-3 text-xs" style={{ color: "#f87171" }}>{errorMsg}</p>
            )}

            {/* Activity feed explainer when not connected */}
            {!isConnected && (
              <div
                className="mt-4 rounded-lg p-3 text-xs"
                style={{ background: "rgba(168,115,26,0.09)", color: "var(--vn-muted)" }}
              >
                When a partner joins with your share code, their transactions will appear in this feed and your budgets will stay in sync.
              </div>
            )}
          </Card>
        </motion.div>

        {/* ── B. Shared Activity Feed ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mb-4"
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm" style={{ color: "var(--vn-text)" }}>
                Recent Activity
              </h2>
              {updatedAt && (
                <span className="text-xs" style={{ color: "var(--vn-muted)" }}>
                  Last synced {timeAgo(updatedAt)}
                </span>
              )}
            </div>

            {transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span style={{ color: "var(--vn-muted)", opacity: 0.5 }}>
                  <IconActivity size={40} />
                </span>
                <p className="text-sm font-medium" style={{ color: "var(--vn-muted)" }}>
                  No shared activity yet.
                </p>
                <p className="text-xs max-w-xs" style={{ color: "var(--vn-muted)", opacity: 0.7 }}>
                  Add transactions and invite a partner to get started.
                </p>
              </div>
            ) : (
              <ul className="space-y-0 divide-y" style={{ borderColor: "var(--vn-border)" }}>
                {transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Avatar */}
                    <Avatar label="You" gold />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate leading-tight"
                        style={{ color: "var(--vn-text)" }}
                      >
                        {tx.label}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: "var(--vn-muted)" }}>
                          {formatDate(tx.date)}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: `${categoryColor(tx.category)}1a`,
                            color: categoryColor(tx.category),
                          }}
                        >
                          {tx.category}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <span
                      className="text-sm font-semibold tabular-nums flex-shrink-0"
                      style={{
                        color: tx.type === "income" ? "#4ade80" : "var(--vn-text)",
                      }}
                    >
                      {formatAmount(tx.amount, tx.type)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>

        {/* ── C. Merge conflict / sync status ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mb-6"
        >
          <Card>
            <div className="flex items-center gap-3">
              {hasMergeConflict ? (
                <>
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                      Reconciliation needed
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--vn-muted)" }}>
                      Your current plan has {currentTxCount} transactions; the previous snapshot had {prevPlanTxCount}.
                      Review changes in Settings → Household.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                    style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
                  >
                    <IconCheck size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                      Plans in sync ✓
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--vn-muted)" }}>
                      No reconciliation needed.
                    </p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </motion.div>

      </div>
    </div>
  );
}
