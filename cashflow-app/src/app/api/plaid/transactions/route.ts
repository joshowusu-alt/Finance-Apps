import { NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import {
  resolveAuthWithCookie,
  fetchPlaidConnections,
  unauthorized,
  serverError,
  checkRateLimit,
} from "@/lib/apiHelpers";
import { defaultDateRange } from "@/lib/dateUtils";
import { mapPlaidCategory } from "@/lib/plaidCategories";
import { suggestCategory } from "@/lib/categorization";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req);
    if (rateLimit) return rateLimit;

    const { startDate, endDate } = await req.json();
    const auth = await resolveAuthWithCookie();

    if (!auth) {
      return unauthorized();
    }

    const connections = await fetchPlaidConnections(auth);
    if (connections.length === 0) {
      return NextResponse.json({ transactions: [] });
    }

    const client = getPlaidClient();
    const range = defaultDateRange();
    const allTransactions = [];

    for (const connection of connections) {
      try {
        const response = await client.transactionsGet({
          access_token: connection.access_token,
          start_date: startDate || range.startDate,
          end_date: endDate || range.endDate,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const converted = response.data.transactions.map((tx: any) => {
          const merchantName = tx.merchant_name || tx.name || "";
          const suggestion = suggestCategory(merchantName, tx.name);
          const category =
            suggestion.confidence >= 50
              ? suggestion.category
              : mapPlaidCategory(tx.category);

          return {
            id: tx.transaction_id,
            date: tx.date,
            description: tx.name,
            merchant: merchantName,
            amount: -tx.amount,
            category,
            categoryConfidence: suggestion.confidence,
            categoryReason: suggestion.reason,
            accountId: tx.account_id,
            itemId: connection.item_id,
            pending: tx.pending,
          };
        });

        allTransactions.push(...converted);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(
          `Error fetching transactions for item ${connection.item_id}:`,
          msg,
        );
      }
    }

    allTransactions.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return NextResponse.json({ transactions: allTransactions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching transactions:", msg);
    return serverError("Failed to fetch transactions", msg);
  }
}
