import { NextResponse } from "next/server";
import {
  resolveAuthWithCookie,
  loadActivePlan,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/apiHelpers";
import { buildAIContext, formatContextForPrompt, type AIFinancialContext } from "@/lib/aiContext";
import { PLAN } from "@/data/plan";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

const checkRateLimit = createRateLimiter(20, 60_000);

// ── Types ─────────────────────────────────────────────────────────────────

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface OpenAIChoice {
  finish_reason: string;
  message: OpenAIMessage;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
}

// ── Tool definitions ──────────────────────────────────────────────────────

const tools = [
  {
    type: "function",
    function: {
      name: "get_spending_summary",
      description:
        "Get spending totals by category for the current period. Use when the user asks about spending breakdown or category totals.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "number",
            description: "Period number to query (default: current period)",
          },
        },
        required: [] as string[],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_transactions",
      description:
        "Get the largest individual transactions in the current period. Use when the user asks about their biggest or most expensive purchases.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of transactions to return (default: 5)",
          },
          category: {
            type: "string",
            description: "Filter by category name (optional)",
          },
        },
        required: [] as string[],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budget_variance",
      description:
        "Get over/under budget amounts by category. Use when the user asks which categories are over or under budget.",
      parameters: {
        type: "object",
        properties: {},
        required: [] as string[],
      },
    },
  },
] as const;

// ── Tool handler ──────────────────────────────────────────────────────────

function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  aiContext: AIFinancialContext,
): string {
  try {
    if (name === "get_spending_summary") {
      const cats = aiContext.variance.byCategory.filter(
        (c) => c.category !== "income",
      );
      return JSON.stringify({
        period: aiContext.period.label,
        totalSpent: aiContext.actuals.spending.amount,
        totalBudget: aiContext.budget.spending,
        categories: cats.map((c) => ({
          category: c.category,
          spent: c.actual,
          budgeted: c.budgeted,
          variance: c.variance,
          status: c.status,
        })),
      });
    }

    if (name === "get_top_transactions") {
      const limit = typeof args.limit === "number" ? args.limit : 5;
      const categoryFilter =
        typeof args.category === "string"
          ? args.category.toLowerCase()
          : null;

      let txns = [...aiContext.recentTransactions].filter(
        (t) => t.type !== "income",
      );

      // Sort by absolute amount descending (largest spend first)
      txns.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      if (categoryFilter) {
        txns = txns.filter((t) =>
          t.category.toLowerCase().includes(categoryFilter),
        );
      }

      return JSON.stringify({
        transactions: txns.slice(0, limit).map((t) => ({
          date: t.date,
          label: t.label,
          amount: Math.abs(t.amount),
          category: t.category,
        })),
      });
    }

    if (name === "get_budget_variance") {
      const cats = aiContext.variance.byCategory.filter(
        (c) => c.category !== "income",
      );
      return JSON.stringify({
        overall: aiContext.variance.overall,
        byCategory: cats.map((c) => ({
          category: c.category,
          budgeted: c.budgeted,
          actual: c.actual,
          variance: c.variance,
          status: c.status,
        })),
        overspent: aiContext.variance.overspentCategories,
        underspent: aiContext.variance.underspentCategories,
      });
    }

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  } catch (err) {
    return JSON.stringify({
      error: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Wraps a pre-computed content string into a minimal SSE stream. */
function contentToSSEStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = JSON.stringify({
    choices: [{ delta: { content }, finish_reason: null }],
  });
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-AI-Model": "gpt-4o-mini",
} as const;

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as { message: unknown };

    if (!message || typeof message !== "string") {
      return badRequest("Message is required");
    }

    // Always resolve auth and load context server-side — never trust client-supplied context
    const auth = await resolveAuthWithCookie();
    if (!auth) return unauthorized();

    const rateIdentifier = auth.userId;
    const { plan } = await loadActivePlan(auth, PLAN);
    const aiContext = buildAIContext(plan);
    const contextString = formatContextForPrompt(aiContext);

    if (!(await checkRateLimit(rateIdentifier))) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI coaching is temporarily unavailable. Please try again later." },
        { status: 503 },
      );
    }

    const systemPrompt = `You are Velanovo, a smart financial coach built into a personal cashflow app. You speak like a knowledgeable friend — warm, direct, and honest.

VOICE & TONE:
- Conversational and warm, never robotic or clinical
- Lead with what matters most — don't bury the headline
- Use specific numbers from their data (never generalize)
- Keep responses to 2-3 short paragraphs max
- Bold **key figures** and **action items**
- Celebrate wins genuinely, address concerns calmly
- End with one clear, actionable next step

TOOLS AVAILABLE (call when helpful):
- get_spending_summary: category-level spending totals for the period
- get_top_transactions: the user's largest individual purchases
- get_budget_variance: which categories are over or under budget

Use a tool when the user wants specific data you can look up precisely. For general questions, the financial summary below is sufficient.

CAPABILITIES:
- Break down budget vs actual by category
- Analyze spending pace and daily budget
- Spot overspending and suggest specific fixes
- Give savings tips tied to their real numbers
- Explain bill patterns and subscriptions
- Forecast end-of-period balance

FORMATTING:
- Use **bold** for key numbers and action items
- Use bullet points for lists
- Keep paragraphs short (2-3 sentences)
- Match the currency shown in the financial data below

USER'S FINANCIAL SNAPSHOT:
${contextString}`;

    // ── First call: non-streaming with tools enabled ───────────────────────
    // We buffer the full response to detect tool_calls before streaming.
    const firstRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!firstRes.ok) {
      console.error("OpenAI API error:", firstRes.status);
      return NextResponse.json(
        { error: "AI coaching is temporarily unavailable. Please try again later." },
        { status: 502 },
      );
    }

    const firstJson = (await firstRes.json()) as OpenAIResponse;
    const choice = firstJson.choices?.[0];

    if (!choice) {
      return NextResponse.json({ error: "No response from AI" }, { status: 502 });
    }

    const assistantMessage = choice.message;

    // ── No tool calls: wrap content in a fake SSE stream ─────────────────
    if (
      choice.finish_reason !== "tool_calls" ||
      !assistantMessage.tool_calls?.length
    ) {
      const content = assistantMessage.content ?? "";
      return new Response(contentToSSEStream(content), { headers: SSE_HEADERS });
    }

    // ── Handle tool calls ─────────────────────────────────────────────────
    const toolResultMessages: OpenAIMessage[] = assistantMessage.tool_calls.map(
      (tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          // invalid JSON args — use empty object
        }
        return {
          role: "tool",
          tool_call_id: tc.id,
          content: handleToolCall(tc.function.name, args, aiContext),
        };
      },
    );

    // ── Second call: streaming with tool results injected ─────────────────
    const secondRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
          assistantMessage,
          ...toolResultMessages,
        ],
        max_tokens: 500,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!secondRes.ok) {
      console.error("OpenAI follow-up API error:", secondRes.status);
      return NextResponse.json(
        { error: "AI coaching is temporarily unavailable. Please try again later." },
        { status: 502 },
      );
    }

    // Pass the OpenAI stream through as SSE
    const reader = secondRes.body!.getReader();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    console.error("AI Assistant error:", error);
    return serverError("Failed to process request");
  }
}
