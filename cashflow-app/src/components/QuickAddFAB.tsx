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
import { useHaptic } from "@/lib/useHaptic";
import { suggestCategory } from "@/lib/categorization";
import type { CashflowCategory, CashflowType } from "@/data/plan";

// Voice transcript → form fields
function parseVoice(raw: string): { label: string; amount: string; type: CashflowType } {
  const lower = raw.toLowerCase().trim();
  const isIncome = /\b(earned|received|income|salary|wages|bonus|deposit|got paid)\b/.test(lower);
  const type: CashflowType = isIncome ? "income" : "outflow";
  const amountMatch = lower.match(/[£$€]?(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? amountMatch[1] : "";
  let label = lower
    .replace(/[£$€]?\d+(?:\.\d{1,2})?/, "")
    .replace(/\b(spent|paid|bought|purchased|received|earned|income|salary|deposit|on|for|at|the|a|an|and|my)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  label = label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
  return { label, amount, type };
}

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
  const haptic = useHaptic();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<CashflowType>("outflow");
  const [category, setCategory] = useState<CashflowCategory>("other");
  const [date, setDate] = useState(today());
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState("");

  function startVoice() {
    type SpeechRec = {
      lang: string; interimResults: boolean; maxAlternatives: number;
      start(): void;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
    };
    type SpeechRecCtor = new () => SpeechRec;
    const win = (typeof window !== "undefined") ? (window as unknown as Record<string, unknown>) : null;
    const Recog = win && ((win.SpeechRecognition || win.webkitSpeechRecognition) as SpeechRecCtor | undefined);
    if (!Recog) { setVoiceHint("Voice not supported in this browser"); return; }
    const recog: SpeechRec = new Recog();
    recog.lang = "en-GB";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    setListening(true);
    setVoiceHint("Listening…");
    recog.onresult = (e) => {
      const transcript = (e.results[0] as ArrayLike<{ transcript: string }>)[0].transcript;
      const parsed = parseVoice(transcript);
      setLabel(parsed.label);
      setAmount(parsed.amount);
      setType(parsed.type);
      if (parsed.label && parsed.type !== "income") {
        const suggestion = suggestCategory(parsed.label);
        setCategory(suggestion.category as CashflowCategory);
      }
      setVoiceHint(`Heard: "${transcript}"`);
      haptic(10);
      setListening(false);
    };
    recog.onerror = () => { setVoiceHint("Couldn't hear — try again"); setListening(false); };
    recog.onend = () => setListening(false);
    recog.start();
  }

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
    haptic(12);
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
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col pt-3"
              style={{ background: "var(--vn-surface)", maxHeight: "85dvh" }}
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
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5 pb-8 flex flex-col gap-4">

              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-jakarta)", color: "var(--vn-text)" }}>
                  Quick Add Transaction
                </h2>
                <button
                  type="button"
                  onClick={startVoice}
                  disabled={listening}
                  title="Voice input"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all active:scale-90 disabled:opacity-50"
                  style={{ background: listening ? "var(--vn-primary, var(--gold))" : "var(--vn-surface-raised, var(--vn-surface))", color: listening ? "white" : "var(--vn-text)" }}
                >
                  {listening ? "🔴" : "🎙️"}
                </button>
              </div>
              {voiceHint && (
                <div className="text-xs text-(--vn-muted) -mt-2 truncate">{voiceHint}</div>
              )}

              {/* Label */}
              <input
                type="text"
                placeholder="Description"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-(--vn-muted)"
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
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-(--vn-muted)"
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
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium min-h-[44px]"
                  style={{ background: "var(--vn-surface-raised)", color: "var(--vn-text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saved}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60 min-h-[44px]"
                  style={{ background: "var(--gold)", color: "var(--vn-bg)" }}
                >
                  {saved ? "Saved ✓" : "Save"}
                </button>
              </div>

              </div>{/* end scrollable content */}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
