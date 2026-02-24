import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { getPlaidClient } from "@/lib/plaid";
import { mapPlaidCategory, mapPlaidType } from "@/lib/plaidCategories";
import { defaultDateRange } from "@/lib/dateUtils";
import type { Plan, Transaction } from "@/data/plan";

export const runtime = "nodejs";

/**
 * Nightly Plaid auto-sync cron.
 *
 * Vercel Cron fires this daily (schedule defined in vercel.json).
 * Uses a Supabase service-role client to enumerate every user who has
 * at least one connected Plaid account, then syncs each one in turn.
 *
 * Required env vars:
 *   CRON_SECRET                 — shared secret verified via Authorization header
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Supabase service-role key (bypasses RLS)
 *   PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV — Plaid credentials
 */

type SyncResult = {
  userId: string;
  imported: number;
  total: number;
  error?: string;
};

export async function GET(request: Request) {
  // ── 1. Verify caller is Vercel Cron ────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Build service-role Supabase client ──────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 500 },
    );
  }

  const admin = createServerClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── 3. Check Plaid credentials exist before touching any user plans ─────────
  let plaidClient;
  try {
    plaidClient = getPlaidClient();
  } catch {
    return NextResponse.json(
      { error: "Plaid credentials not configured" },
      { status: 500 },
    );
  }

  // ── 4. Enumerate all users with connected Plaid accounts ──────────────────
  const { data: connections, error: connErr } = await admin
    .from("plaid_connections")
    .select("user_id, access_token, item_id");

  if (connErr) {
    return NextResponse.json(
      { error: "Failed to load Plaid connections", details: connErr.message },
      { status: 500 },
    );
  }

  if (!connections || connections.length === 0) {
    return NextResponse.json({ ok: true, usersProcessed: 0, message: "No connected accounts" });
  }

  // Group connections by user
  const byUser = new Map<string, { access_token: string; item_id: string }[]>();
  for (const c of connections) {
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
    byUser.get(c.user_id)!.push({ access_token: c.access_token, item_id: c.item_id });
  }

  // ── 5. Sync each user ──────────────────────────────────────────────────────
  const results: SyncResult[] = [];
  const range = defaultDateRange();
  const nowIso = new Date().toISOString();

  for (const [userId, userConnections] of byUser) {
    try {
      // Load the user's active scenario
      const { data: scenarioRow } = await admin
        .from("user_scenarios")
        .select("scenario_id")
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle();
      const scenarioId = scenarioRow?.scenario_id ?? "default";

      // Load the user's current plan
      const { data: planRow } = await admin
        .from("user_plans")
        .select("plan_json")
        .eq("user_id", userId)
        .eq("scenario_id", scenarioId)
        .maybeSingle();

      if (!planRow?.plan_json) {
        results.push({ userId, imported: 0, total: 0, error: "No plan found" });
        continue;
      }

      const plan: Plan =
        typeof planRow.plan_json === "string"
          ? JSON.parse(planRow.plan_json)
          : planRow.plan_json;

      // Fetch transactions from each Plaid connection for this user
      const plaidTransactions: any[] = [];
      for (const conn of userConnections) {
        try {
          const response = await plaidClient.transactionsGet({
            access_token: conn.access_token,
            start_date: range.startDate,
            end_date: range.endDate,
          });
          plaidTransactions.push(...response.data.transactions);
        } catch (plaidErr: any) {
          // Log per-connection failures but keep going for other connections
          console.error(
            `[cron/plaid-sync] Plaid fetch failed for item ${conn.item_id} (user ${userId}):`,
            plaidErr?.response?.data?.error_message ?? plaidErr.message,
          );
        }
      }

      // Convert to internal Transaction format
      const incoming: Transaction[] = plaidTransactions.map((tx) => ({
        id: `plaid-${tx.transaction_id}`,
        date: tx.date,
        label: tx.merchant_name || tx.name,
        amount: Math.abs(tx.amount),
        type: mapPlaidType(tx.amount),
        category: mapPlaidCategory(tx.personal_finance_category?.primary
          ? [tx.personal_finance_category.primary]
          : tx.category),
        notes: `${tx.name} (auto-synced)`,
      }));

      // Deduplicate against existing transactions
      const existingIds = new Set(plan.transactions.map((t) => t.id));
      const toAdd = incoming.filter((t) => !existingIds.has(t.id));

      if (toAdd.length === 0) {
        results.push({ userId, imported: 0, total: plan.transactions.length });
        continue;
      }

      const updatedPlan: Plan = {
        ...plan,
        transactions: [...plan.transactions, ...toAdd].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      };

      // Save the updated plan
      await admin.from("user_plans").upsert(
        {
          user_id: userId,
          scenario_id: scenarioId,
          plan_json: updatedPlan,
          prev_plan_json: plan,
          updated_at: nowIso,
        },
        { onConflict: "user_id,scenario_id" },
      );

      // Stamp last_synced_at on all connections for this user
      await admin
        .from("plaid_connections")
        .update({ last_synced_at: nowIso })
        .eq("user_id", userId);

      results.push({
        userId,
        imported: toAdd.length,
        total: updatedPlan.transactions.length,
      });
    } catch (userErr: any) {
      // Isolate per-user failures so one bad account doesn't abort the run
      console.error(`[cron/plaid-sync] Error processing user ${userId}:`, userErr.message);
      results.push({ userId, imported: 0, total: 0, error: userErr.message });
    }
  }

  // ── 6. Return summary ──────────────────────────────────────────────────────
  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  const errors = results.filter((r) => r.error);

  return NextResponse.json({
    ok: true,
    timestamp: nowIso,
    usersProcessed: results.length,
    totalImported,
    errors: errors.length,
    ...(errors.length > 0 && { errorDetails: errors }),
  });
}
