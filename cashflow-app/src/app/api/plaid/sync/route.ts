import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureMainPlan, saveMainPlan } from "@/lib/mainStore";
import { MAIN_COOKIE_NAME } from "@/lib/mainStore";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@/lib/supabase/server";
import { PLAN, type Plan, type Transaction, type CashflowType, type CashflowCategory } from "@/data/plan";

export const runtime = "nodejs";

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || "sandbox";

  if (!clientId || !secret) {
    throw new Error("Missing Plaid credentials");
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

function getSQL() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(databaseUrl);
}

export async function POST(req: Request) {
  try {
    const { startDate, endDate } = await req.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let plan: Plan;
    let prevPlan: Plan | null = null;
    let scenarioId = "default";
    let effectiveUserId: string | null = user?.id ?? null;

    if (user) {
      const { data: scenarioRow } = await supabase
        .from("user_scenarios")
        .select("scenario_id")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      scenarioId = scenarioRow?.scenario_id ?? "default";

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
      } else {
        plan = PLAN;
      }
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

      if (!token) {
        return NextResponse.json({ error: "Missing main token" }, { status: 401 });
      }

      effectiveUserId = token;
      const main = await ensureMainPlan(token);
      plan = main.plan;
      prevPlan = main.prevPlan ?? null;
    }

    let connections: Array<{ access_token: string; item_id: string }> = [];
    if (user && effectiveUserId) {
      const { data } = await supabase
        .from("plaid_connections")
        .select("access_token, item_id")
        .eq("user_id", effectiveUserId);
      connections = (data ?? []) as Array<{ access_token: string; item_id: string }>;
    } else if (effectiveUserId) {
      // Get all access tokens for this user (using token as userId)
      const sql = getSQL();
      connections = (await sql`
        SELECT access_token, item_id
        FROM plaid_connections
        WHERE user_id = ${effectiveUserId}
      `) as Array<{ access_token: string; item_id: string }>;
    }

    if (connections.length === 0) {
      return NextResponse.json({
        error: "No bank accounts connected. Connect a bank account first.",
      }, { status: 400 });
    }

    const client = getPlaidClient();
    const plaidTransactions: any[] = [];

    // Fetch transactions from all connected accounts
    for (const connection of connections) {
      try {
        const response = await client.transactionsGet({
          access_token: connection.access_token,
          start_date: startDate || getDefaultStartDate(),
          end_date: endDate || getDefaultEndDate(),
        });

        plaidTransactions.push(...response.data.transactions);
      } catch (error: any) {
        console.error(`Error fetching transactions for item ${connection.item_id}:`, error.message);
      }
    }

    // Convert Plaid transactions to Plan Transaction format
    const newTransactions: Transaction[] = plaidTransactions.map((tx) => ({
      id: `plaid-${tx.transaction_id}`,
      date: tx.date,
      label: tx.merchant_name || tx.name,
      amount: Math.abs(tx.amount), // Plaid uses positive for debits, convert to positive amount
      type: mapType(tx.amount),
      category: mapCategory(tx.category),
      notes: `${tx.name} (Plaid)`,
    }));

    // Merge with existing transactions (avoid duplicates)
    const existingIds = new Set(plan.transactions.map((t) => t.id));
    const transactionsToAdd = newTransactions.filter((t) => !existingIds.has(t.id));

    const updatedPlan: Plan = {
      ...plan,
      transactions: [...plan.transactions, ...transactionsToAdd].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    };

    let updatedAt: number | null = null;

    if (user && effectiveUserId) {
      const nowIso = new Date().toISOString();
      await supabase.from("user_plans").upsert(
        {
          user_id: effectiveUserId,
          scenario_id: scenarioId,
          plan_json: updatedPlan,
          prev_plan_json: plan,
          updated_at: nowIso,
        },
        { onConflict: "user_id,scenario_id" }
      );
      updatedAt = new Date(nowIso).getTime();

      await supabase
        .from("plaid_connections")
        .update({ last_synced_at: nowIso })
        .eq("user_id", effectiveUserId);
    } else if (effectiveUserId) {
      const updated = await saveMainPlan(effectiveUserId, updatedPlan, prevPlan);
      updatedAt = updated;

      const sql = getSQL();
      await sql`
        UPDATE plaid_connections
        SET last_synced_at = ${new Date()}
        WHERE user_id = ${effectiveUserId}
      `;
    }

    return NextResponse.json({
      success: true,
      imported: transactionsToAdd.length,
      total: updatedPlan.transactions.length,
      updatedAt,
    });
  } catch (error: any) {
    console.error("Error syncing transactions:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to sync transactions", details: error.message },
      { status: 500 }
    );
  }
}

function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 90); // Last 90 days
  return date.toISOString().split("T")[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split("T")[0];
}

function mapType(plaidAmount: number): CashflowType {
  if (plaidAmount < 0) {
    // Negative in Plaid means credit (money coming in)
    return "income";
  } else {
    // Positive in Plaid means debit (money going out)
    return "outflow";
  }
}

function mapCategory(plaidCategories: string[] | null): CashflowCategory {
  if (!plaidCategories || plaidCategories.length === 0) {
    return "other";
  }

  const primary = plaidCategories[0].toLowerCase();

  // Map Plaid categories to Plan categories
  if (
    primary.includes("payroll") ||
    primary.includes("income") ||
    primary.includes("transfer in") ||
    primary.includes("deposit")
  ) {
    return "income";
  }

  if (
    primary.includes("rent") ||
    primary.includes("utilities") ||
    primary.includes("mortgage") ||
    primary.includes("subscription") ||
    primary.includes("phone") ||
    primary.includes("internet") ||
    primary.includes("insurance")
  ) {
    return "bill";
  }

  if (
    primary.includes("savings") ||
    primary.includes("investment") ||
    primary.includes("transfer")
  ) {
    return "savings";
  }

  if (
    primary.includes("donation") ||
    primary.includes("charity") ||
    primary.includes("religious") ||
    primary.includes("tithe") ||
    primary.includes("offering")
  ) {
    return "giving";
  }

  if (
    primary.includes("food") ||
    primary.includes("restaurant") ||
    primary.includes("groceries") ||
    primary.includes("shopping") ||
    primary.includes("entertainment")
  ) {
    return "allowance";
  }

  // Default to other
  return "other";
}
