"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { loadPlan } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import type { Transaction } from "@/data/plan";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: string;
  href?: string;
  action?: () => void;
  group: "Navigate" | "Action" | "Transaction";
  keywords?: string;
};

// ─── Static commands ─────────────────────────────────────────────────────────

const NAV_COMMANDS: CommandItem[] = [
  { id: "nav-/",            label: "Dashboard",       icon: "🏠", href: "/",            group: "Navigate" },
  { id: "nav-plan",         label: "Plan",            icon: "📋", href: "/plan",         group: "Navigate" },
  { id: "nav-timeline",     label: "Timeline",        icon: "📅", href: "/timeline",     group: "Navigate" },
  { id: "nav-insights",     label: "Insights",        icon: "📈", href: "/insights",     group: "Navigate" },
  { id: "nav-transactions", label: "Transactions",    icon: "💳", href: "/transactions", group: "Navigate" },
  { id: "nav-bills",        label: "Bills",           icon: "🧾", href: "/bills",        group: "Navigate" },
  { id: "nav-income",       label: "Income",          icon: "💰", href: "/income",       group: "Navigate" },
  { id: "nav-goals",        label: "Goals",           icon: "🎯", href: "/goals",        group: "Navigate" },
  { id: "nav-envelopes",    label: "Envelope Budget", icon: "✉️", href: "/envelopes",    group: "Navigate" },
  { id: "nav-networth",     label: "Net Worth",       icon: "📊", href: "/networth",     group: "Navigate" },
  { id: "nav-import",       label: "Import CSV / OFX", icon: "📂", href: "/import",     group: "Navigate" },
  { id: "nav-coach",        label: "AI Coach",        icon: "🤖", href: "/coach",        group: "Navigate" },
  { id: "nav-settings",     label: "Settings",        icon: "⚙️", href: "/settings",    group: "Navigate" },
  { id: "nav-review",       label: "Review",          icon: "🔍", href: "/review",       group: "Navigate" },
];

// ─── Fuzzy match ─────────────────────────────────────────────────────────────

function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;
  // Word-boundary match
  const words = t.split(/\s+/);
  if (words.some(w => w.startsWith(q))) return 60;
  // Acronym check
  const initials = words.map(w => w[0]).join("");
  if (initials.includes(q)) return 40;
  // Character-in-sequence
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 20 : 0;
}

function scoreItem(item: CommandItem & { txnLabel?: string }, query: string): number {
  if (!query) return 1;
  const s1 = fuzzyScore(item.label, query);
  const s2 = item.description ? fuzzyScore(item.description, query) : 0;
  const s3 = item.keywords ? fuzzyScore(item.keywords, query) : 0;
  return Math.max(s1, s2, s3);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // ── Keyboard shortcut ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Focus input on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Transaction commands from plan ─────────────────────────────────────────
  const txnCommands = useMemo((): CommandItem[] => {
    if (!open) return [];
    try {
      const plan = loadPlan();
      const recent = [...plan.transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50);
      return recent.map((t: Transaction): CommandItem => ({
        id: `txn-${t.id}`,
        label: t.label,
        description: `${t.date} · ${t.type === "income" ? "+" : "-"}${formatMoney(t.amount)} · ${t.category}`,
        icon: t.type === "income" ? "💚" : "💸",
        href: "/transactions",
        group: "Transaction",
        keywords: `${t.label} ${t.category} ${t.date} ${t.amount}`,
      }));
    } catch { return []; }
  }, [open]);

  // ── All commands merged ────────────────────────────────────────────────────
  const allCommands = useMemo(() => [...NAV_COMMANDS, ...txnCommands], [txnCommands]);

  // ── Filter + rank ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show nav commands + recent 5 transactions
      return [
        ...NAV_COMMANDS,
        ...txnCommands.slice(0, 5),
      ];
    }
    return allCommands
      .map(item => ({ item, score: scoreItem(item, query) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item)
      .slice(0, 20);
  }, [query, allCommands, txnCommands]);

  // ── Reset activeIndex when filtered changes ────────────────────────────────
  useEffect(() => { setActiveIndex(0); }, [filtered]);

  // ── Keyboard navigation inside modal ──────────────────────────────────────
  function onKeyDownModal(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) executeItem(item);
    }
  }

  const executeItem = useCallback((item: CommandItem) => {
    setOpen(false);
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  }, [router]);

  // ── Auto-scroll active item into view ────────────────────────────────────
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Group rendering ───────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const cur = map.get(item.group) ?? [];
      cur.push(item);
      map.set(item.group, cur);
    }
    return map;
  }, [filtered]);

  let globalIndex = 0;

  return (
    <>
      {/* Trigger hint — shown in sidebar / header by CSS, not rendered here */}
      {/* The palette itself */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              className="fixed z-[9999] left-1/2 top-[12vh] w-full max-w-xl -translate-x-1/2"
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: "var(--vn-surface, #1e2535)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onKeyDown={onKeyDownModal}
              >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                  <span className="text-base text-[var(--vn-muted)]">🔍</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search pages, actions, transactions…"
                    className="flex-1 bg-transparent outline-none text-[var(--vn-text)] text-sm placeholder:text-[var(--vn-muted)]"
                  />
                  <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[var(--vn-muted)] bg-white/5 rounded px-1.5 py-0.5 border border-white/10 select-none">
                    Esc
                  </kbd>
                </div>

                {/* Results list */}
                <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
                  {groups.size === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-[var(--vn-muted)]">
                      No results for &ldquo;{query}&rdquo;
                    </div>
                  )}

                  {[...groups.entries()].map(([group, items]) => (
                    <div key={group}>
                      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--vn-muted)]">
                        {group}
                      </div>
                      {items.map(item => {
                        const idx = globalIndex++;
                        const isActive = idx === activeIndex;
                        return (
                          <button
                            key={item.id}
                            data-index={idx}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isActive
                                ? "bg-[var(--vn-primary)]/15 text-[var(--vn-text)]"
                                : "hover:bg-white/5 text-[var(--vn-text)]"
                            }`}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => executeItem(item)}
                          >
                            <span className="text-base shrink-0 w-6 text-center">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.label}</div>
                              {item.description && (
                                <div className="text-[11px] text-[var(--vn-muted)] truncate mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            {isActive && (
                              <kbd className="shrink-0 text-[10px] text-[var(--vn-muted)] bg-white/5 rounded px-1.5 py-0.5 border border-white/10">
                                ↵
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2.5 border-t border-white/10 flex items-center gap-4 text-[10px] text-[var(--vn-muted)]">
                  <span><kbd className="bg-white/5 rounded px-1 border border-white/10">↑↓</kbd> navigate</span>
                  <span><kbd className="bg-white/5 rounded px-1 border border-white/10">↵</kbd> open</span>
                  <span><kbd className="bg-white/5 rounded px-1 border border-white/10">Esc</kbd> close</span>
                  <span className="ml-auto">
                    <kbd className="bg-white/5 rounded px-1 border border-white/10">{typeof window !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl"}</kbd>
                    <kbd className="bg-white/5 rounded px-1 border border-white/10 ml-0.5">K</kbd>
                    {" "}anywhere
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
