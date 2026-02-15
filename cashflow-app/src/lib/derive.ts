import type { Plan } from "@/data/plan";
import {
  buildTimeline,
  generateEvents,
  getPeriod,
  getStartingBalance,
  minPoint,
  type TimelineRow,
} from "@/lib/cashflowEngine";
import { prettyDate } from "@/lib/formatUtils";

export type DerivedDay = {
  date: string;
  label: string;
  income: number;
  outflow: number;
  balance: number;
  net: number;
  belowMin: boolean;
};

export type Derived = {
  period: {
    id: number;
    label: string;
    start: string;
    end: string;
    days: string[];
  };
  totals: {
    incomeExpected: number;
    committedBills: number;
    allocationsTotal: number;
    remaining: number;
  };
  cashflow: {
    daily: DerivedDay[];
    lowest: { date: string; balance: number };
    daysBelowMin: number;
  };
  health: {
    label: "Healthy" | "Watch" | "At Risk";
    reason: string;
  };
  incomeStability: {
    label: "Consistent" | "Variable";
    explanation: string;
    variance?: number;
  };
  savingsHealth: {
    savingsThisPeriod: number;
    streak: number;
    explanation: string;
    streakExplanation: string;
    leftoverLabel: string;
    leftoverValue: number;
  };
  flags: {
    hasStartingBalance: boolean;
  };
};



function cadenceLabel(cadence: string) {
  if (cadence === "weekly") return "weekly";
  if (cadence === "biweekly") return "bi-weekly";
  return "monthly";
}

function sumBy<T>(items: T[], predicate: (item: T) => boolean, value: (item: T) => number) {
  return items.filter(predicate).reduce((sum, item) => sum + value(item), 0);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function variance(values: number[]) {
  if (values.length <= 1) return 0;
  const avg = average(values);
  const raw = values.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / values.length;
  return Math.round(raw * 100) / 100;
}

function buildHealthReason(
  label: Derived["health"]["label"],
  lowest: { date: string; balance: number },
  eventsOnLowest: { hasBills: boolean; hasOutflows: boolean },
  expectedMin: number
) {
  const driver = eventsOnLowest.hasBills ? "bills" : eventsOnLowest.hasOutflows ? "outflows" : "timing";
  const date = prettyDate(lowest.date);
  if (label === "Healthy") {
    return expectedMin > 0
      ? `Lowest point on ${date} stays above your minimum.`
      : `Lowest point on ${date} stays above zero.`;
  }
  if (label === "Watch") {
    return `Lowest point on ${date} dips below your minimum, driven by ${driver}. Consider increasing buffer or trimming allocations.`;
  }
  return `Lowest point on ${date} goes negative, driven by ${driver}. Consider reducing bills or adding income.`;
}

function buildDaily(rows: TimelineRow[], expectedMin: number): DerivedDay[] {
  return rows.map((row) => ({
    date: row.date,
    label: row.label,
    income: row.income,
    outflow: row.outflow,
    balance: row.balance,
    net: row.net,
    belowMin: expectedMin > 0 && row.balance < expectedMin,
  }));
}

function computeSavingsStreak(plan: Plan, periodId: number) {
  const sorted = [...plan.periods].sort((a, b) => a.id - b.id).slice(-12); // cap to 12 periods (C3)
  let streak = 0;
  for (let idx = sorted.length - 1; idx >= 0; idx -= 1) {
    const period = sorted[idx];
    const events = generateEvents(plan, period.id);
    const budgeted = events
      .filter((e) => e.type === "outflow" && e.category === "savings")
      .reduce((sum, e) => sum + e.amount, 0);
    if (budgeted <= 0) continue;
    const actual = plan.transactions
      .filter(
        (t) =>
          t.date >= period.start &&
          t.date <= period.end &&
          t.type === "transfer" &&
          t.category === "savings"
      )
      .reduce((sum, t) => sum + t.amount, 0);
    if (actual >= budgeted) {
      streak += 1;
    } else {
      break;
    }
  }

  const currentPeriod = getPeriod(plan, periodId);
  const historyExists = plan.transactions.some((t) => t.date < currentPeriod.start);
  if (!historyExists) {
    return { streak: 0, explanation: "Complete a period to start tracking your savings streak." };
  }

  if (streak > 0) {
    return {
      streak,
      explanation: `You have met your savings target for ${streak} period${streak === 1 ? "" : "s"} in a row.`,
    };
  }

  return {
    streak: 0,
    explanation: "No savings streak yet. Hit your savings target to start one.",
  };
}

export function deriveApp(plan: Plan, periodId?: number): Derived {
  const resolvedPeriodId = periodId ?? plan.setup.selectedPeriodId;
  const period = getPeriod(plan, resolvedPeriodId);
  const startingBalance = getStartingBalance(plan, resolvedPeriodId);
  const override = plan.periodOverrides.find((o) => o.periodId === resolvedPeriodId);
  const hasStartingBalance =
    typeof override?.startingBalance === "number" || plan.setup.startingBalance !== 0;

  const events = generateEvents(plan, resolvedPeriodId);
  const incomeExpected = sumBy(events, (e) => e.type === "income", (e) => e.amount);
  const billIds = new Set(plan.bills.map((b) => b.id));
  const committedBills = sumBy(
    events,
    (e) => e.type === "outflow" && billIds.has(e.sourceId ?? ""),
    (e) => e.amount
  );
  const allocationsTotal = sumBy(
    events,
    (e) => e.type === "outflow" && !billIds.has(e.sourceId ?? ""),
    (e) => e.amount
  );
  const remaining = incomeExpected - committedBills - allocationsTotal;

  const rows = buildTimeline(plan, resolvedPeriodId, startingBalance);
  const expectedMin = plan.setup.expectedMinBalance;
  const daily = buildDaily(rows, expectedMin);
  const lowestRow = minPoint(rows);
  const lowest = lowestRow
    ? { date: lowestRow.date, balance: lowestRow.balance }
    : { date: period.start, balance: startingBalance };
  const daysBelowMin = daily.filter((d) => d.belowMin).length;

  const healthLabel: Derived["health"]["label"] =
    lowest.balance < 0
      ? "At Risk"
      : expectedMin > 0 && lowest.balance < expectedMin
        ? "Watch"
        : "Healthy";

  const eventsOnLowest = events.filter((e) => e.date === lowest.date);
  const hasBills = eventsOnLowest.some((e) => e.type === "outflow" && e.category === "bill");
  const hasOutflows = eventsOnLowest.some((e) => e.type === "outflow");
  const healthReason = buildHealthReason(healthLabel, lowest, { hasBills, hasOutflows }, expectedMin);

  // N3: incomeVariance uses planned rule amounts, not actual transaction amounts.
  // A user with consistent rules but irregular actual income will still be labelled
  // "Consistent". Incorporating actual transaction variance is a future improvement.
  const incomeRules = plan.incomeRules.filter((r) => r.enabled);
  const incomeAmounts = incomeRules.map((r) => r.amount);
  const incomeVariance = variance(incomeAmounts);
  const cadenceSet = new Set(incomeRules.map((r) => r.cadence));
  const avgIncome = average(incomeAmounts);
  const amountSpread = incomeAmounts.length ? Math.max(...incomeAmounts) - Math.min(...incomeAmounts) : 0;
  const stableAmounts = avgIncome > 0 ? amountSpread <= avgIncome * 0.1 : amountSpread === 0;
  const consistent = incomeRules.length <= 1 || (cadenceSet.size <= 1 && stableAmounts);

  const incomeStabilityLabel: Derived["incomeStability"]["label"] =
    incomeRules.length === 0 ? "Variable" : consistent ? "Consistent" : "Variable";

  const incomeStabilityExplanation =
    incomeRules.length === 0
      ? "No income rules set yet. Add income to assess stability."
      : consistent
        ? incomeRules.length === 1
          ? `Single income source on a ${cadenceLabel(incomeRules[0].cadence)} cadence.`
          : "Income rules use similar cadence and amounts."
        : "Income varies by cadence or amount, which can make cashflow less predictable.";

  const savingsThisPeriod = sumBy(
    events,
    (e) => e.type === "outflow" && e.category === "savings",
    (e) => e.amount
  );
  const streakInfo = computeSavingsStreak(plan, resolvedPeriodId);
  const leftoverLabel = "Remaining After Plan";
  const leftoverValue = remaining;
  const savingsExplanation = `${leftoverLabel} is what's left after income, bills, and allocations.`;

  return {
    period: {
      id: period.id,
      label: period.label,
      start: period.start,
      end: period.end,
      days: daily.map((d) => d.date),
    },
    totals: {
      incomeExpected,
      committedBills,
      allocationsTotal,
      remaining,
    },
    cashflow: {
      daily,
      lowest,
      daysBelowMin,
    },
    health: {
      label: healthLabel,
      reason: healthReason,
    },
    incomeStability: {
      label: incomeStabilityLabel,
      explanation: incomeStabilityExplanation,
      variance: incomeRules.length ? incomeVariance : undefined,
    },
    savingsHealth: {
      savingsThisPeriod,
      streak: streakInfo.streak,
      explanation: savingsExplanation,
      streakExplanation: streakInfo.explanation,
      leftoverLabel,
      leftoverValue,
    },
    flags: {
      hasStartingBalance,
    },
  };
}
