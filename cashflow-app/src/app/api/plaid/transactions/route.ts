import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { neon } from "@neondatabase/serverless";
import { suggestCategory } from "@/lib/categorization";

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
    const { userId, startDate, endDate } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Get all access tokens for this user
    const sql = getSQL();
    const connections = await sql`
      SELECT access_token, item_id
      FROM plaid_connections
      WHERE user_id = ${userId}
    `;

    if (connections.length === 0) {
      return NextResponse.json({ transactions: [] });
    }

    const client = getPlaidClient();
    const allTransactions = [];

    // Fetch transactions for each connected account
    for (const connection of connections) {
      try {
        const response = await client.transactionsGet({
          access_token: connection.access_token,
          start_date: startDate || getDefaultStartDate(),
          end_date: endDate || getDefaultEndDate(),
        });

        const transactions = response.data.transactions;

        // Convert Plaid transactions to our format
        const converted = transactions.map((tx: any) => {
          // Use ML-based categorization
          const merchantName = tx.merchant_name || tx.name || "";
          const suggestion = suggestCategory(merchantName, tx.name);

          // Use ML suggestion if confidence is high enough, otherwise fall back to Plaid category
          let category = suggestion.confidence >= 50
            ? suggestion.category
            : mapCategory(tx.category);

          return {
            id: tx.transaction_id,
            date: tx.date,
            description: tx.name,
            merchant: merchantName,
            amount: -tx.amount, // Plaid uses positive for debits, we use negative
            category,
            categoryConfidence: suggestion.confidence,
            categoryReason: suggestion.reason,
            accountId: tx.account_id,
            itemId: connection.item_id,
            pending: tx.pending,
          };
        });

        allTransactions.push(...converted);
      } catch (error: any) {
        console.error(`Error fetching transactions for item ${connection.item_id}:`, error.message);
        // Continue with other accounts even if one fails
      }
    }

    // Sort by date descending
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ transactions: allTransactions });
  } catch (error: any) {
    console.error("Error fetching transactions:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to fetch transactions", details: error.message },
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

function mapCategory(plaidCategories: string[] | null): string {
  if (!plaidCategories || plaidCategories.length === 0) {
    return "other";
  }

  const primary = plaidCategories[0].toLowerCase();

  // Map Plaid categories to our categories: income, bill, expense, savings, giving, other
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
    primary.includes("internet")
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
    primary.includes("religious")
  ) {
    return "giving";
  }

  // Default to expense for most transactions
  return "expense";
}
