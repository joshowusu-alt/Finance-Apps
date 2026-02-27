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
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-(--vn-text)">💡 Subscription review</span>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            {formatMoney(totalMonthly)}/mo
          </span>
        </div>
        <div className="text-xs text-(--vn-muted) mt-0.5">
          {count} recurring charge{count !== 1 ? "s" : ""} — tap to review
        </div>
      </div>
      <Link href="/insights" className="vn-btn vn-btn-ghost text-xs whitespace-nowrap">
        Review →
      </Link>
    </div>
  );
}
