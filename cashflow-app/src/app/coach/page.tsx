"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loadPlan } from "@/lib/storage";
import { buildAIContext, formatContextForPrompt, type AIFinancialContext } from "@/lib/aiContext";
import { formatMoney } from "@/lib/currency";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeButton } from "@/components/ProGate";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Inline bold parser ──────────────────────────────────────────────────────
function parseBold(text: string, baseKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = baseKey;
  while (remaining.length > 0) {
    const m = remaining.match(/\*\*(.+?)\*\*/);
    if (m && m.index !== undefined) {
      if (m.index > 0) parts.push(remaining.slice(0, m.index));
      parts.push(<strong key={key++} className="font-semibold">{m[1]}</strong>);
      remaining = remaining.slice(m.index + m[0].length);
    } else { parts.push(remaining); break; }
  }
  return parts;
}

// ── Stat row detector ───────────────────────────────────────────────────────
// Matches lines like:  **Spent:** £34.00  or  **Daily budget:** £12/day (55%)
const STAT_ROW_RE = /^\*\*(.+?):\*\*\s+(.+)$/;

function isMoneyOrPct(val: string) {
  return /[£$€\d]/.test(val) || /%/.test(val);
}

function pctFromStr(val: string): number | null {
  const m = val.match(/(\d+(?:\.\d+)?)%/);
  return m ? Math.min(100, parseFloat(m[1])) : null;
}

function StatCard({ label, value, k }: { label: string; value: string; k: number }) {
  const pct = pctFromStr(value);
  return (
    <div
      key={k}
      className="flex flex-col gap-1 rounded-xl p-2.5"
      style={{ background: "var(--vn-bg)", border: "1px solid var(--vn-border)" }}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--vn-muted)" }}>
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
        {value.replace(/\*\*/g, "")}
      </span>
      {pct !== null && (
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "var(--vn-border)" }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: pct > 85 ? "#b85c5c" : pct > 65 ? "#d4914f" : "#4FAF7B",
              transition: "width 0.6s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main message renderer ─────────────────────────────────────────────────
function renderMessage(content: string, isStreaming: boolean): React.ReactNode {
  if (!content) return null;

  // Split into paragraphs on blank lines
  const blocks = content.split(/\n{2,}/);
  let keyCounter = 0;

  const rendered = blocks.map((block, bi) => {
    const lines = block.split("\n");

    // Check if this block looks like a stat table (≥2 lines matching STAT_ROW_RE
    // AND at least one looks like a money/% value)
    const statLines = lines.map((l) => ({ m: l.match(STAT_ROW_RE), raw: l }));
    const matchCount = statLines.filter((sl) => sl.m).length;
    const hasMoneyPct = statLines.some((sl) => sl.m && isMoneyOrPct(sl.m[2]));

    if (matchCount >= 2 && hasMoneyPct) {
      // Render as a mini stat grid
      return (
        <div key={`block-${bi}`} className="grid grid-cols-2 gap-1.5 my-2" role="group" aria-label="Financial summary">
          {statLines.map((sl, li) => {
            if (sl.m) {
              return <StatCard key={`sc-${bi}-${li}`} label={sl.m[1]} value={sl.m[2]} k={keyCounter++} />;
            }
            // Non-stat line mixed in, render inline
            return sl.raw ? (
              <p key={`p-${bi}-${li}`} className="col-span-2 text-[13px] leading-relaxed">
                {parseBold(sl.raw, keyCounter++)}
              </p>
            ) : null;
          })}
        </div>
      );
    }

    // Bullet list block
    if (lines.every((l) => l.startsWith("•") || l.startsWith("-") || l === "")) {
      return (
        <ul key={`block-${bi}`} className="space-y-1 my-1 list-none" role="list">
          {lines.filter(Boolean).map((l, li) => (
            <li key={li} className="flex gap-2 text-[13px] leading-relaxed">
              <span aria-hidden="true" className="shrink-0 mt-0.5" style={{ color: "var(--vn-primary)" }}>•</span>
              <span>{parseBold(l.replace(/^[•\-]\s*/, ""), keyCounter++)}</span>
            </li>
          ))}
        </ul>
      );
    }

    // Plain paragraph
    return (
      <p key={`block-${bi}`} className="text-[13px] leading-relaxed whitespace-pre-wrap my-0.5">
        {parseBold(block, keyCounter++)}
      </p>
    );
  });

  return (
    <div className="space-y-1">
      {rendered}
      {isStreaming && (
        <span className="inline-block w-0.5 h-[1em] bg-(--vn-muted) ml-0.5 align-middle animate-pulse" />
      )}
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  "Am I on track this period?",
  "Where am I overspending?",
  "How much can I spend per day?",
  "What's my end-of-period forecast?",
  "How can I save more?",
];

// Contextual follow-ups based on what topic was just discussed
const FOLLOW_UPS: Record<string, string[]> = {
  budget:       ["Show me my spending breakdown", "What's my daily budget?", "How can I save more?"],
  spending:     ["Am I on track overall?", "How can I cut spending?", "Show my subscriptions"],
  savings:      ["What's my daily budget?", "What's my forecast?", "Where am I overspending?"],
  forecast:     ["How can I save more?", "Am I on track?", "Show spending by category"],
  daily:        ["Where am I overspending?", "What's my forecast?", "How can I save more?"],
  subscription: ["Am I on track?", "How can I save more?", "Show spending breakdown"],
  default:      ["Am I on track this period?", "Show my spending breakdown", "What's my forecast?"],
};

function getFollowUps(lastUserMessage: string): string[] {
  const q = lastUserMessage.toLowerCase();
  if (q.includes("budget") || q.includes("track"))       return FOLLOW_UPS.budget;
  if (q.includes("spent") || q.includes("spending") || q.includes("overspend")) return FOLLOW_UPS.spending;
  if (q.includes("save") || q.includes("saving"))        return FOLLOW_UPS.savings;
  if (q.includes("forecast") || q.includes("project"))   return FOLLOW_UPS.forecast;
  if (q.includes("daily") || q.includes("per day"))       return FOLLOW_UPS.daily;
  if (q.includes("subscription") || q.includes("recurring")) return FOLLOW_UPS.subscription;
  return FOLLOW_UPS.default;
}

// ---------------------------------------------------------------------------
// Local fallback response generator (uses same localStorage data as the UI)
// ---------------------------------------------------------------------------

function generateLocalResponse(
  message: string,
  ctx: AIFinancialContext,
  expectedMinBalance: number,
): string {
  const q = message.toLowerCase();
  const fmt = formatMoney;

  const daysLeft = ctx.period.daysTotal - ctx.period.daysElapsed;
  const dailyBudget = daysLeft > 0 ? ctx.actuals.leftover / daysLeft : 0;
  const topOverspent = ctx.variance.byCategory
    .filter(c => c.status === "over" && c.category !== "income")
    .sort((a, b) => b.variance - a.variance)[0];

  // ── Budget / on-track ────────────────────────────────────────────────────
  if (q.includes("budget") || q.includes("track") || q.includes("on track")) {
    const sp = ctx.smartPace.spending;

    if (sp.isNormal || sp.status === "on-track") {
      let r = `You're doing great — right on track!\n\n`;
      r += `**Spent:** ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)}\n`;
      r += `**Remaining:** ${fmt(ctx.actuals.leftover)}\n\n`;
      if (ctx.smartPace.spendingPattern === "front-loaded" && ctx.period.timeProgress < 0.5) {
        r += `Your bills are front-loaded so the big spending is done. Smooth sailing from here!\n\n`;
      }
      r += `You can comfortably spend **${fmt(dailyBudget)}/day** for the next ${daysLeft} days.`;
      return r;
    }

    if (sp.status === "ahead" && !sp.isNormal) {
      const extra = Math.abs(sp.variance);
      let r = `Heads up — you're running a bit ahead of pace.\n\n`;
      r += `**Spent:** ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)}\n`;
      r += `That's about **${fmt(extra)} more** than your usual rhythm by this point.\n\n`;
      r += `**Quick wins to get back on track:**\n`;
      if (topOverspent) r += `• **${topOverspent.category}** is running hot — worth a quick review\n`;
      r += `• Aim for **${fmt(Math.max(0, dailyBudget))}/day** going forward\n`;
      r += `• Try a no-spend day tomorrow\n\n`;
      r += `Nothing alarming — just a gentle course correction!`;
      return r;
    }

    if (sp.status === "behind") {
      const saved = Math.abs(sp.variance);
      let r = `Nice work! You're under budget.\n\n`;
      r += `**Spent:** ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)}\n`;
      r += `You're **${fmt(saved)} under** your usual pace — extra breathing room.\n\n`;
      r += `**What to do with the surplus:**\n`;
      r += `• Move some to savings\n`;
      r += `• Build your emergency fund\n`;
      r += `• Or simply enjoy the cushion!`;
      return r;
    }

    let r = `Looking good — everything's balanced!\n\n`;
    r += `**Spent:** ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)}\n`;
    r += `**Remaining:** ${fmt(ctx.actuals.leftover)}\n\n`;
    r += `Aim for **${fmt(dailyBudget)}/day** for the next ${daysLeft} days.`;
    return r;
  }

  // ── Daily budget ─────────────────────────────────────────────────────────
  if (q.includes("daily") || q.includes("per day") || q.includes("how much can i spend")) {
    let r = `Here's your daily spending guide:\n\n`;
    r += `**Daily budget:** ${fmt(dailyBudget)}\n`;
    r += `**Days remaining:** ${daysLeft}\n`;
    r += `**Total remaining:** ${fmt(ctx.actuals.leftover)}\n\n`;
    if (dailyBudget > 0) {
      r += `That's **${fmt(dailyBudget * 7)}/week** if you prefer to think weekly.\n\n`;
      r += `**Tip:** Keep weekday spending lower so you have more flexibility on weekends!`;
    } else {
      r += `Things are tight — consider holding off on non-essential purchases until your next income.`;
    }
    return r;
  }

  // ── Spending / overspending ──────────────────────────────────────────────
  if (q.includes("spent") || q.includes("spending") || q.includes("overspend")) {
    const top = ctx.variance.byCategory
      .filter(c => c.category !== "income" && c.actual > 0)
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 4);

    let r = `Here's your spending breakdown:\n\n`;
    r += `**Total spent:** ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)} (${Math.round(ctx.actuals.spending.progress * 100)}%)\n\n`;
    if (top.length > 0) {
      r += `**By category:**\n`;
      top.forEach(c => {
        const dot = c.status === "over" ? "over" : c.status === "under" ? "under" : "on-target";
        r += `• **${c.category}:** ${fmt(c.actual)} / ${fmt(c.budgeted)} (${dot})\n`;
      });
      r += `\n`;
    }
    if (ctx.variance.overspentCategories.length > 0) {
      r += `**Focus area:** ${ctx.variance.overspentCategories[0]} is over budget — review recent purchases there.`;
    } else {
      r += `Everything's within budget — great discipline!`;
    }
    return r;
  }

  // ── Savings ──────────────────────────────────────────────────────────────
  if (q.includes("save") || q.includes("saving")) {
    const pct = Math.round(ctx.actuals.savings.progress * 100);
    const gap = ctx.budget.savings * ctx.period.timeProgress - ctx.actuals.savings.amount;

    let r = `Here's your savings snapshot:\n\n`;
    r += `**Saved:** ${fmt(ctx.actuals.savings.amount)} of ${fmt(ctx.budget.savings)} target (${pct}%)\n\n`;

    if (ctx.budget.savings === 0) {
      r += `You don't have a savings target set yet. Even a small amount each period adds up!\n\n`;
      r += `**Next step:** Set a savings goal in your outflow rules.`;
    } else if (gap > 0) {
      r += `You're **${fmt(gap)} behind** where you'd ideally be.\n\n`;
      r += `**Catch-up plan:**\n`;
      r += `• Transfer **${fmt(gap / Math.max(1, Math.ceil(daysLeft / 7)))}/week** to close the gap\n`;
      r += `• Look for a subscription to pause\n`;
      r += `• Try one home-cooked meal swap this week`;
    } else {
      r += `You're ahead of your savings target — brilliant!\n\n`;
      r += `**Level up ideas:**\n`;
      r += `• Increase your savings goal by 10% next period\n`;
      r += `• Direct the extra to your emergency fund`;
    }
    return r;
  }

  // ── Forecast ─────────────────────────────────────────────────────────────
  if (q.includes("forecast") || q.includes("end") || q.includes("project")) {
    let r = `Here's your end-of-period forecast:\n\n`;
    r += `**Projected balance:** ${fmt(ctx.forecast.projectedEndBalance)}\n`;
    if (ctx.forecast.lowestBalance) {
      r += `**Lowest point:** ${fmt(ctx.forecast.lowestBalance.amount)} on ${ctx.forecast.lowestBalance.date}\n`;
    }
    r += `\n`;

    if (ctx.forecast.riskDays > 0) {
      r += `Your balance may dip below your **${fmt(expectedMinBalance)}** safety net.\n\n`;
      r += `**How to avoid this:**\n`;
      r += `• Delay large purchases until after your next income\n`;
      r += `• Check if any bills can be rescheduled\n`;
      r += `• Consider a temporary freeze on non-essentials`;
    } else {
      r += `Your balance stays healthy throughout — no danger zones!\n\n`;
      if (ctx.forecast.scenarios.length > 0) {
        r += `**Scenarios:**\n`;
        ctx.forecast.scenarios.forEach(s => {
          r += `• ${s.label}: ${fmt(s.endBalance)}\n`;
        });
      }
    }
    return r;
  }

  // ── Subscriptions ────────────────────────────────────────────────────────
  if (q.includes("subscription") || q.includes("recurring")) {
    if (ctx.subscriptions.detected.length === 0) {
      return `No recurring subscriptions detected yet.\n\nAs more transactions come in, I'll spot patterns automatically. Most people have 2-3 subscriptions they've forgotten about!\n\n**Next step:** Check your bank statement for any recurring charges.`;
    }
    let r = `Here are your detected subscriptions:\n\n`;
    r += `**Total:** ${fmt(ctx.subscriptions.totalMonthly)}/month\n\n`;
    ctx.subscriptions.detected.slice(0, 5).forEach(s => {
      r += `• **${s.name}:** ${fmt(s.amount)} (${s.frequency})\n`;
    });
    r += `\n**Challenge:** Pick ONE to cancel or downgrade this week!`;
    return r;
  }

  // ── Default with top insights ────────────────────────────────────────────
  if (ctx.insights.length > 0) {
    let r = `${ctx.insights[0].message}\n\n`;
    if (ctx.insights.length > 1) {
      r += `**Also worth knowing:**\n`;
      ctx.insights.slice(1, 3).forEach(i => { r += `• ${i.message}\n`; });
      r += `\n`;
    }
    r += `Ask me about your budget, savings, forecast, or spending breakdown!`;
    return r;
  }

  return `I can help you with:\n\n• **Budget check** — Am I on track?\n• **Spending analysis** — Where's my money going?\n• **Savings tips** — How can I save more?\n• **Forecast** — What's my end-of-period outlook?\n• **Subscriptions** — What recurring costs do I have?\n\nWhat would you like to know?`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey there! I'm your financial coach — I can see your budget, spending patterns, and forecasts. Ask me anything about your money, or tap a suggestion below.",
};

const CHAT_STORAGE_KEY = "vn_chat_history";

// ---------------------------------------------------------------------------
// Coach Page Component
// ---------------------------------------------------------------------------

export default function CoachPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [INITIAL_MESSAGE];
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as Message[];
    } catch {
      // ignore malformed storage
    }
    // Try to build a proactive welcome if a plan is already loaded
    try {
      const plan = loadPlan();
      const ctx = buildAIContext(plan);
      const insight = ctx.insights[0];
      if (insight) {
        return [{
          id: "welcome",
          role: "assistant",
          content: `Hey there! I'm your financial coach.\n\n${insight.message}\n\nAsk me anything about your money, or tap a suggestion below.`,
        }];
      }
    } catch {
      // no plan loaded yet, fall back to static welcome
    }
    return [INITIAL_MESSAGE];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modelName, setModelName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isPro, isLoading: subLoading } = useSubscription();

  const freeMessageCount = messages.filter(m => m.role === "user").length;
  const hitFreeLimit = !subLoading && !isPro && freeMessageCount >= 3;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Persist conversation to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 1) {
      try {
        // Keep last 50 messages to avoid storage bloat
        const toSave = messages.slice(-50);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
      } catch {
        // ignore storage errors (e.g. private browsing quota)
      }
    }
  }, [messages]);

  const getFinancialContext = useCallback((): {
    ctx: AIFinancialContext;
    formatted: string;
    expectedMinBalance: number;
  } | null => {
    try {
      const plan = loadPlan();
      const ctx = buildAIContext(plan);
      return {
        ctx,
        formatted: formatContextForPrompt(ctx),
        expectedMinBalance: plan.setup.expectedMinBalance,
      };
    } catch {
      return null;
    }
  }, []);

  async function sendMessage(messageText?: string) {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");
    setIsLoading(true);

    const financial = getFinancialContext();
    const streamingId = `ai-${Date.now()}`;

    // Add a blank streaming message immediately
    setMessages(prev => [...prev, { id: streamingId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          financialContext: financial?.formatted,
        }),
        credentials: "include",
      });

      if (!res.ok || !res.body) throw new Error("request failed");

      // Capture AI model name from response header
      const model = res.headers.get("X-AI-Model");
      if (model) setModelName(model);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep the last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") break;

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === streamingId
                    ? { ...m, content: m.content + delta }
                    : m,
                ),
              );
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      // Check if we got any content at all — if not, fall back to local
      setMessages(prev => {
        const streamed = prev.find(m => m.id === streamingId);
        if (!streamed?.content && financial) {
          const fallback = generateLocalResponse(text, financial.ctx, financial.expectedMinBalance);
          return prev.map(m => m.id === streamingId ? { ...m, content: fallback } : m);
        }
        return prev;
      });
    } catch {
      setModelName("Local");
      const content = financial
        ? generateLocalResponse(text, financial.ctx, financial.expectedMinBalance)
        : "Sorry, I couldn't process your request. Please try again.";

      setMessages(prev =>
        prev.map(m => m.id === streamingId ? { ...m, content } : m),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 text-white" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)" }}>
        <button
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/");
          }}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          aria-label="Close coach"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm">Financial Coach</h1>
            <p className="text-xs text-white/80">
              {modelName === "Local"
                ? "Local mode · no AI key"
                : modelName
                ? `${modelName} · Powered by your data`
                : "Powered by your data"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
            setMessages([
              {
                id: "welcome-new",
                role: "assistant",
                content: "Fresh start! What would you like to know about your finances?",
              },
            ]);
          }}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          aria-label="Clear conversation"
          title="Clear conversation"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((msg, idx) => {
          const isStreamingMsg = isLoading && msg.role === "assistant" && idx === messages.length - 1;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "text-white rounded-br-md"
                    : "bg-(--vn-surface) border border-(--vn-border) text-(--vn-text) rounded-bl-md"
                }`}
                style={msg.role === "user" ? { background: "linear-gradient(135deg, #a8731a, #d4a843)" } : undefined}
              >
                {isStreamingMsg && !msg.content ? (
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-(--vn-muted) rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-(--vn-muted) rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-(--vn-muted) rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                ) : (
                  <div>
                    {renderMessage(msg.content, isStreamingMsg)}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips — initial or contextual follow-ups */}
      {!isLoading && (() => {
        const lastAssistant = messages[messages.length - 1]?.role === "assistant";
        if (!lastAssistant) return null;

        // Find the last user message to determine context
        const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
        const isInitial = !lastUserMsg; // only welcome message so far
        const chips = isInitial ? SUGGESTED_QUESTIONS : getFollowUps(lastUserMsg.content);
        const label = isInitial ? "Try asking:" : "What's next?";

        return (
          <div className="px-4 pb-2">
            <p className="text-xs text-(--vn-muted) mb-2">{label}</p>
            <div className="flex flex-wrap gap-2">
              {chips.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 min-h-9 bg-(--vn-bg) text-(--vn-text) rounded-full hover:border-(--vn-gold)/60 transition-colors border border-(--vn-border)"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Input */}
      <div className="p-3 border-t border-(--vn-border) bg-(--vn-surface)">
        {hitFreeLimit ? (
          <div className="text-center py-3 px-4">
            <p className="text-xs mb-3" style={{ color: "var(--vn-muted)" }}>You&apos;ve used your 3 free AI messages. Upgrade to Pro for unlimited coaching.</p>
            <UpgradeButton size="sm" />
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-(--vn-bg) text-(--vn-text) rounded-xl text-sm placeholder:text-(--vn-muted) focus:outline-none focus:ring-2 focus:ring-(--vn-gold)/50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ background: "linear-gradient(135deg, #a8731a, #d4a843)" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
