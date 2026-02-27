import { NextResponse } from "next/server";
import {
  resolveAuthWithCookie,
  loadActivePlan,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/apiHelpers";
import { buildAIContext, formatContextForPrompt } from "@/lib/aiContext";
import { PLAN } from "@/data/plan";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

const checkRateLimit = createRateLimiter(20, 60_000);

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

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

    if (!checkRateLimit(rateIdentifier)) {
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

    const systemPrompt = `You are a sharp, friendly financial coach inside Velanovo, a personal cashflow app. You speak like a knowledgeable friend — warm but honest, encouraging but real.

VOICE & TONE:
- Conversational and warm, never robotic or clinical
- Lead with what matters most — don't bury the headline
- Use specific numbers from their data (never generalize)
- Keep responses to 2-3 short paragraphs max
- Bold **key figures** and **action items**
- Celebrate wins genuinely, address concerns calmly
- End with one clear, actionable next step

CAPABILITIES:
- Break down budget vs actual by category
- Analyze spending pace and daily budget
- Spot overspending and suggest specific fixes
- Give savings tips tied to their real numbers
- Explain bill patterns and subscriptions
- Forecast end-of-period balance
- Suggest concrete money moves

FORMATTING:
- Use **bold** for key numbers and action items
- Use bullet points for lists
- Keep paragraphs short (2-3 sentences)
- Match the currency shown in the financial data below

USER'S FINANCIAL DATA:
${contextString}`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
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
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      console.error("OpenAI API error status:", response.status);
      return NextResponse.json(
        { error: "AI coaching is temporarily unavailable. Please try again later." },
        { status: 502 },
      );
    }

    // Pass the OpenAI stream through as SSE
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              break;
            }
            // Forward the raw SSE chunks from OpenAI directly
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-AI-Model": "gpt-4o-mini",
      },
    });
  } catch (error) {
    console.error("AI Assistant error:", error);
    return serverError("Failed to process request");
  }
}
