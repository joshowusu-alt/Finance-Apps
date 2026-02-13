import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAIN_COOKIE_NAME, ensureMainPlan } from "@/lib/mainStore";
import { buildAIContext, formatContextForPrompt } from "@/lib/aiContext";
import type { Plan } from "@/data/plan";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Simple in-memory rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const limit = rateLimits.get(identifier);

    if (!limit || now > limit.resetTime) {
        rateLimits.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (limit.count >= RATE_LIMIT) {
        return false;
    }

    limit.count++;
    return true;
}

export async function POST(req: Request) {
    try {
        const { message, financialContext } = await req.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Determine rate-limit identifier from auth or IP
        let rateIdentifier = "";
        let contextString = typeof financialContext === "string" ? financialContext : "";

        // If client didn't send context, fall back to server-side plan fetch
        if (!contextString) {
            const supabase = await createClient();
            const user = supabase ? (await supabase.auth.getUser()).data.user : null;
            let plan: Plan | null = null;

            if (user && supabase) {
                const { data: scenarioRow } = await supabase
                    .from("user_scenarios")
                    .select("scenario_id")
                    .eq("user_id", user.id)
                    .eq("active", true)
                    .maybeSingle();
                const scenarioId = scenarioRow?.scenario_id ?? "default";

                const { data: planRow } = await supabase
                    .from("user_plans")
                    .select("plan_json")
                    .eq("user_id", user.id)
                    .eq("scenario_id", scenarioId)
                    .maybeSingle();

                if (planRow?.plan_json) {
                    plan = typeof planRow.plan_json === "string"
                        ? (JSON.parse(planRow.plan_json) as Plan)
                        : (planRow.plan_json as Plan);
                }
                rateIdentifier = user.id;
            }

            if (!plan) {
                const cookieStore = await cookies();
                const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

                if (!token) {
                    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
                }

                if (!rateIdentifier) rateIdentifier = token;
                const main = await ensureMainPlan(token);
                plan = main.plan;
            }

            const aiContext = buildAIContext(plan);
            contextString = formatContextForPrompt(aiContext);
        }

        // Fallback rate identifier from IP
        if (!rateIdentifier) {
            const forwarded = req.headers.get("x-forwarded-for");
            rateIdentifier = forwarded?.split(",")[0]?.trim() || "anonymous";
        }

        if (!checkRateLimit(rateIdentifier)) {
            return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
        }

        // Check for OpenAI API key
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            // Tell client to generate its own fallback locally
            return NextResponse.json({ noApiKey: true, source: "local" });
        }

        // Enhanced system prompt — conversational, warm, data-driven
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

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                max_tokens: 500,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            console.error("OpenAI API error:", await response.json());
            // Tell client to generate fallback locally
            return NextResponse.json({ noApiKey: true, source: "local" });
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

        return NextResponse.json({
            response: aiResponse,
            source: "openai"
        });

    } catch (error) {
        console.error("AI Assistant error:", error);
        return NextResponse.json(
            { error: "Failed to process request" },
            { status: 500 }
        );
    }
}
