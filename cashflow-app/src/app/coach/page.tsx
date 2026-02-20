"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { loadPlan } from "@/lib/storage";
import { buildAIContext, formatContextForPrompt, type AIFinancialContext } from "@/lib/aiContext";
import { formatMoney } from "@/lib/currency";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function renderContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }
  return parts;
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
// Coach Page Component
// ---------------------------------------------------------------------------

export default function CoachPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey there! I'm your financial coach — I can see your budget, spending patterns, and forecasts. Ask me anything about your money, or tap a suggestion below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      <div className="flex items-center gap-3 px-4 py-3 bg-linear-to-r from-violet-500 to-purple-600 text-white">
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
            <p className="text-xs text-white/80">Powered by your data</p>
          </div>
        </div>
        <button
          onClick={() =>
            setMessages([
              {
                id: "welcome-new",
                role: "assistant",
                content: "Fresh start! What would you like to know about your finances?",
              },
            ])
          }
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          aria-label="New conversation"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
                    ? "bg-violet-500 text-white rounded-br-md"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md"
                }`}
              >
                {isStreamingMsg && !msg.content ? (
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {renderContent(msg.content)}
                    {isStreamingMsg && <span className="inline-block w-[2px] h-[1em] bg-slate-500 ml-0.5 align-middle animate-pulse" />}
                  </p>
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
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{label}</p>
            <div className="flex flex-wrap gap-2">
              {chips.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 min-h-9 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors border border-violet-200 dark:border-violet-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Input */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-violet-500 text-white rounded-xl hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
