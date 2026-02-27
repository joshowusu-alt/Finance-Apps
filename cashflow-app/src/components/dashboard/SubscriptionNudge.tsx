import Link from "next/link";
import { formatMoney } from "@/lib/currency";

interface SubscriptionNudgeProps {
  count: number;
  totalMonthly: number;
}

/**
 * Inline banner that prompts the user to review actionable subscriptions.
 * Rendered inside a `vn-card` wrapper with an amber left border in `page.tsx`.
 */
export function SubscriptionNudge({ count, totalMonthly }: SubscriptionNudgeProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold text-(--vn-text)">💡 Subscription review</div>
        <div className="text-xs text-(--vn-muted) mt-0.5">
          {count} subscription{count > 1 ? "s" : ""} worth reviewing —{" "}
          {formatMoney(totalMonthly)}/month
        </div>
      </div>
      <Link href="/insights" className="vn-btn vn-btn-ghost text-xs whitespace-nowrap">
        Review →
      </Link>
    </div>
  );
}
