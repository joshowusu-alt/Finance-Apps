import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureMainPlan, saveMainPlan } from "@/lib/mainStore";
import { MAIN_COOKIE_NAME } from "@/lib/mainStore";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { neon } from "@neondatabase/serverless";
import type { Transaction, CashflowType, CashflowCategory } from "@/data/plan";

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
    const cookieStore = await cookies();
    const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: "Missing main token" }, { status: 401 });
    }

    const { startDate, endDate } = await req.json();

    // Get user's current plan
    const { plan, prevPlan } = await ensureMainPlan(token);

    // Get all access tokens for this user (using token as userId)
    const sql = getSQL();
    const connections = await sql`
      SELECT access_token, item_id
      FROM plaid_connections
      WHERE user_id = ${token}
    `;

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

    const updatedPlan = {
      ...plan,
      transactions: [...plan.transactions, ...transactionsToAdd].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    };

    // Save updated plan
    const updatedAt = await saveMainPlan(token, updatedPlan, prevPlan);

    // Update last synced timestamp
    await sql`
      UPDATE plaid_connections
      SET last_synced_at = ${new Date()}
      WHERE user_id = ${token}
    `;

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
