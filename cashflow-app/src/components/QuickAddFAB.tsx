"use client";

/**
 * QuickAddFAB
 *
 * Floating action button that opens a bottom-sheet to add a one-off
 * transaction directly from any page. Saves to the current plan and
 * dispatches PLAN_UPDATED_EVENT so all open views refresh.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import type { CashflowCategory, CashflowType } from "@/data/plan";

const CATEGORIES: CashflowCategory[] = [
  "bill",
  "giving",
  "savings",
  "allowance",
  "buffer",
  "other",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateId(): string {
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function QuickAddFAB() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<CashflowType>("outflow");
  const [category, setCategory] = useState<CashflowCategory>("other");
  const [date, setDate] = useState(today());
  const [saved, setSaved] = useState(false);

  function reset() {
    setLabel("");
    setAmount("");
    setType("outflow");
    setCategory("other");
    setDate(today());
    setSaved(false);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 300);
  }

  function handleSave() {
    const amt = parseFloat(amount);
    if (!label.trim() || isNaN(amt) || amt <= 0) return;

    const plan = loadPlan();
    const updated = {
      ...plan,
      transactions: [
        ...(plan.transactions ?? []),
        {
          id: generateId(),
          date,
          label: label.trim(),
          amount: amt,
          type,
          category: type === "income" ? ("income" as CashflowCategory) : category,
        },
      ],
    };
    savePlan(updated);
    window.dispatchEvent(new Event(PLAN_UPDATED_EVENT));
    setSaved(true);
    setTimeout(close, 900);
  }

  return (
    <>
      {/* FAB button */}
      <button
        aria-label="Quick add transaction"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold transition-transform active:scale-95"
        style={{ background: "var(--gold)", color: "var(--vn-bg)" }}
      >
        +
      </button>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="fab-backdrop"
              className="fixed inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            {/* Sheet */}
            <motion.div
              key="fab-sheet"
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-5 flex flex-col gap-4"
              style={{ background: "var(--vn-surface)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 300) close();
              }}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto -mt-1" />

              <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-jakarta)", color: "var(--vn-text)" }}>
                Quick Add Transaction
              </h2>

              {/* Label */}
              <input
                type="text"
                placeholder="Description"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--vn-surface-raised)", color: "var(--vn-text)", border: "1px solid var(--vn-border)" }}
              />

              {/* Amount + type row */}
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--vn-surface-raised)", color: "var(--vn-text)", border: "1px solid var(--vn-border)" }}
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CashflowType)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--vn-surface-raised)", color: "var(--vn-text)", border: "1px solid var(--vn-border)" }}
                >
                  <option value="outflow">Outflow</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              {/* Category (hidden when income) */}
              {type !== "income" && (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CashflowCategory)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--vn-surface-raised)", color: "var(--vn-text)", border: "1px solid var(--vn-border)" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              )}

              {/* Date */}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--vn-surface-raised)", color: "var(--vn-text)", border: "1px solid var(--vn-border)" }}
              />

              {/* Actions */}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={close}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: "var(--vn-surface-raised)", color: "var(--vn-text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saved}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={{ background: "var(--gold)", color: "var(--vn-bg)" }}
                >
                  {saved ? "Saved ✓" : "Save"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
