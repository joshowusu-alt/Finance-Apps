import { NextResponse } from "next/server";
import { z } from "zod";
import { saveMainPlan } from "@/lib/mainStore";
import { getPlaidClient, mapPlaidTransaction } from "@/lib/plaid";
import { getSQL } from "@/lib/db";
import {
  resolveAuthWithCookie,
  loadActivePlan,
  fetchPlaidConnections,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/apiHelpers";
import { defaultDateRange } from "@/lib/dateUtils";
import type { Transaction as PlaidTransaction } from "plaid";
import { PLAN, type Plan, type Transaction } from "@/data/plan";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

const checkSyncLimit = createRateLimiter(5, 60_000);

export async function POST(req: Request) {
  try {
    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
    const bodySchema = z.object({
      startDate: dateSchema,
      endDate: dateSchema,
      userId: z.string().optional(),
    });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }
    const { startDate, endDate } = parsed.data;
    const auth = await resolveAuthWithCookie();

    if (!auth) {
      return unauthorized("Missing authentication");
    }

    if (!(await checkSyncLimit(auth.userId))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { plan, prevPlan, scenarioId } = await loadActivePlan(auth, PLAN);

    const connections = await fetchPlaidConnections(auth);
    if (connections.length === 0) {
      return badRequest(
        "No bank accounts connected. Connect a bank account first.",
      );
    }

    const client = getPlaidClient();
    const range = defaultDateRange();
    const plaidTransactions: PlaidTransaction[] = [];

    for (const connection of connections) {
      try {
        const response = await client.transactionsGet({
          access_token: connection.access_token,
          start_date: startDate || range.startDate,
          end_date: endDate || range.endDate,
        });
        plaidTransactions.push(...response.data.transactions);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(
          `Error fetching transactions for item ${connection.item_id}:`,
          msg,
        );
      }
    }

    // Convert Plaid transactions to Plan Transaction format (dedup included)
    const existingIds = new Set(plan.transactions.map((t) => t.id));
    const transactionsToAdd = plaidTransactions
      .map((tx) => mapPlaidTransaction(tx, existingIds))
      .filter((t): t is Transaction => t !== null);

    const updatedPlan: Plan = {
      ...plan,
      transactions: [...plan.transactions, ...transactionsToAdd].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };

    let updatedAt: number | null = null;

    if (auth.user && auth.supabase) {
      const nowIso = new Date().toISOString();
      await auth.supabase.from("user_plans").upsert(
        {
          user_id: auth.userId,
          scenario_id: scenarioId,
          plan_json: updatedPlan,
          prev_plan_json: plan,
          updated_at: nowIso,
        },
        { onConflict: "user_id,scenario_id" },
      );
      updatedAt = new Date(nowIso).getTime();

      await auth.supabase
        .from("plaid_connections")
        .update({ last_synced_at: nowIso })
        .eq("user_id", auth.userId);
    } else {
      const updated = await saveMainPlan(auth.userId, updatedPlan, prevPlan);
      updatedAt = updated;

      const sql = getSQL();
      await sql`
        UPDATE plaid_connections
        SET last_synced_at = ${new Date()}
        WHERE user_id = ${auth.userId}
      `;
    }

    return NextResponse.json({
      success: true,
      imported: transactionsToAdd.length,
      total: updatedPlan.transactions.length,
      updatedAt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      "Error syncing transactions:",
      msg,
    );
    return serverError("Failed to sync transactions", msg);
  }
}
