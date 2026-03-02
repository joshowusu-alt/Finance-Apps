import type { Plan } from "@/data/plan";
import {
  buildTimeline,
  buildActualsTimeline,
  generateEvents,
  getPeriod,
  getStartingBalance,
  getActualsStartingBalance,
  minPoint,
  type TimelineRow,
} from "@/lib/cashflowEngine";
import { average, stdDev, dayDiff } from "@/lib/dateUtils";
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
    daily: DerivedDay[];         // Budget (planned) — full period
    actualsDaily: DerivedDay[];  // Actuals (recorded) — up to today only
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
  /** What fraction of the period has elapsed expressed as a stage */
  periodStage: "early" | "mid" | "late" | "closing";
  /** Weekly spending patterns for pattern-detection in Sprint 9 */
  weeklyPatterns: {
    week4OverspendDetected: boolean;
    overspendWeekIndex: number | null;
    weeklySpend: number[];
    weeklyDiscretionarySpend: number[];
  };
  /** Expected-spend curve pace — compares actual vs what was planned-to-date per event dates */
  spendingPace: {
    discretionaryActualSpend: number;
    discretionaryBudget: number;
    paceGap: number;
    isFrontLoadedBills: boolean;
    scheduledBillFractionToDate: number;
    expectedSpentToDate: number;
    actualSpentToDate: number;
    varianceToExpected: number;
    tolerance: number;
    paceStatus: "pacing-well" | "running-ahead" | "running-below";
    totalPlannedOutflows: number;
  };
  /** Period-over-period deltas vs the previous period */
  deltas: {
    overspendVsLastPeriod: number | null;
    riskDaysVsLastPeriod: number | null;
    savingsVsLastPeriod: number | null;
  };
  /** Single highest-priority actionable recommendation */
  primaryRecommendation: {
    action: string;
    reason: string;
    urgency: "high" | "medium" | "low";
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

  // Budget forecast — pure planned rules, bills and outflow rules (no actual transactions)
  const rows = buildTimeline(plan, resolvedPeriodId, startingBalance);
  const expectedMin = plan.setup.expectedMinBalance;
  const daily = buildDaily(rows, expectedMin);

  // Actuals — driven purely by real logged transactions.
  // Start from the previous period's actual ending balance (chained from
  // setup.startingBalance) so the actuals line is independent of the budget
  // starting balance and salary double-counting is avoided.
  const actualsStart = getActualsStartingBalance(plan, resolvedPeriodId);
  const actualsRows = buildActualsTimeline(plan, resolvedPeriodId, actualsStart);
  const actualsDaily = buildDaily(actualsRows, expectedMin);
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
  const incomeVariance = Math.round(stdDev(incomeAmounts) ** 2 * 100) / 100;
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

  // ── New Sprint 8/9 fields ──────────────────────────────────────────────────

  // Period stage — how far through the period are we?
  const periodDaysTotal = dayDiff(period.start, period.end) + 1;
  const daysElapsedInPeriod = Math.min(Math.max(dayDiff(period.start, plan.setup.asOfDate) + 1, 0), periodDaysTotal);
  const timeProgressInPeriod = periodDaysTotal > 0 ? Math.min(1, daysElapsedInPeriod / periodDaysTotal) : 0;
  const periodStage: Derived["periodStage"] =
    timeProgressInPeriod < 0.25 ? "early" :
    timeProgressInPeriod < 0.65 ? "mid" :
    timeProgressInPeriod < 0.90 ? "late" : "closing";

  // Weekly spend patterns
  const periodActualOutflows = plan.transactions.filter(
    (t) => t.date >= period.start && t.date <= period.end && t.type === "outflow" && t.category !== "savings"
  );
  const weeklySpend: number[] = [0, 0, 0, 0];
  const weeklyDiscretionarySpend: number[] = [0, 0, 0, 0];
  periodActualOutflows.forEach((t) => {
    const weekIdx = Math.min(3, Math.floor(dayDiff(period.start, t.date) / 7));
    weeklySpend[weekIdx] += t.amount;
    if (t.category !== "bill") weeklyDiscretionarySpend[weekIdx] += t.amount;
  });
  const weeksStarted = Math.floor(daysElapsedInPeriod / 7);
  const week4OverspendDetected =
    weeksStarted >= 4 &&
    weeklyDiscretionarySpend[0] + weeklyDiscretionarySpend[1] + weeklyDiscretionarySpend[2] > 0
      ? weeklyDiscretionarySpend[3] > (weeklyDiscretionarySpend[0] + weeklyDiscretionarySpend[1] + weeklyDiscretionarySpend[2]) / 3 * 1.3
      : false;
  const overspendWeekIndex: number | null = (() => {
    if (weeksStarted < 2) return null;
    const completedWeeks = weeklyDiscretionarySpend.slice(0, Math.min(weeksStarted, 4));
    if (completedWeeks.length < 2) return null;
    const avg = completedWeeks.reduce((a, b) => a + b, 0) / completedWeeks.length;
    const maxIdx = completedWeeks.reduce((best, v, i) => (v > completedWeeks[best] ? i : best), 0);
    return completedWeeks[maxIdx] > avg * 1.3 ? maxIdx : null;
  })();

  // Front-loaded bill detection — avoid false "spending ahead" alarms
  const billEventsToDate = events.filter(
    (e) => e.type === "outflow" && billIds.has(e.sourceId ?? "") && e.date <= plan.setup.asOfDate
  );
  const billsScheduledBeforeNow = billEventsToDate.reduce((s, e) => s + e.amount, 0);
  const scheduledBillFractionToDate = committedBills > 0 ? billsScheduledBeforeNow / committedBills : 0;
  const isFrontLoadedBills = scheduledBillFractionToDate > timeProgressInPeriod + 0.2;
  const discretionaryActualSpend = periodActualOutflows
    .filter((t) => t.category !== "bill")
    .reduce((s, t) => s + t.amount, 0);
  const discretionaryBudget = Math.max(0, allocationsTotal - savingsThisPeriod);
  const discretionaryPaceGap =
    discretionaryBudget > 0
      ? Math.min(1, discretionaryActualSpend / discretionaryBudget) - timeProgressInPeriod
      : 0;

  // Expected-spend curve — driven by planned event dates, not linear time
  const expectedSpentToDate = events
    .filter((e) => e.type === "outflow" && e.category !== "savings" && e.date <= plan.setup.asOfDate)
    .reduce((s, e) => s + e.amount, 0);
  const actualSpentToDate = periodActualOutflows.reduce((s, t) => s + t.amount, 0);
  const totalPlannedOutflows = Math.max(0, committedBills + allocationsTotal - savingsThisPeriod);
  const spendingTolerance = Math.max(30, totalPlannedOutflows * 0.03);
  const varianceToExpected = actualSpentToDate - expectedSpentToDate;
  const paceStatus: "pacing-well" | "running-ahead" | "running-below" =
    Math.abs(varianceToExpected) <= spendingTolerance
      ? "pacing-well"
      : varianceToExpected > spendingTolerance
        ? "running-ahead"
        : "running-below";

  // Deltas vs previous period
  const sortedPeriodsAscForDeltas = [...plan.periods].sort((a, b) => a.id - b.id);
  const currentPeriodIdx = sortedPeriodsAscForDeltas.findIndex((p) => p.id === resolvedPeriodId);
  const prevPeriodRecord = currentPeriodIdx > 0 ? sortedPeriodsAscForDeltas[currentPeriodIdx - 1] : null;
  let deltas: Derived["deltas"] = {
    overspendVsLastPeriod: null,
    riskDaysVsLastPeriod: null,
    savingsVsLastPeriod: null,
  };
  if (prevPeriodRecord) {
    const prevDerived = deriveApp(plan, prevPeriodRecord.id);
    const prevActualSpend = plan.transactions
      .filter(
        (t) =>
          t.date >= prevPeriodRecord.start &&
          t.date <= prevPeriodRecord.end &&
          t.type === "outflow" &&
          t.category !== "savings"
      )
      .reduce((sum, t) => sum + t.amount, 0);
    const prevBudgetSpend =
      prevDerived.totals.committedBills +
      prevDerived.totals.allocationsTotal -
      prevDerived.savingsHealth.savingsThisPeriod;
    const currActualSpend = periodActualOutflows.reduce((sum, t) => sum + t.amount, 0);
    const currBudgetSpend = allocationsTotal + committedBills - savingsThisPeriod;
    const prevOverspend = prevBudgetSpend > 0 ? prevActualSpend - prevBudgetSpend : 0;
    const currOverspend = currBudgetSpend > 0 ? currActualSpend - currBudgetSpend : 0;
    deltas = {
      overspendVsLastPeriod: currOverspend - prevOverspend,
      riskDaysVsLastPeriod: daysBelowMin - prevDerived.cashflow.daysBelowMin,
      savingsVsLastPeriod: savingsThisPeriod - prevDerived.savingsHealth.savingsThisPeriod,
    };
  }

  // Primary recommendation — highest-priority action
  let primaryRecommendation: Derived["primaryRecommendation"];
  if (lowest.balance < 0) {
    primaryRecommendation = {
      action: "Reduce bills or move income earlier to avoid a negative balance",
      reason: `Your balance is forecast to go negative on ${prettyDate(lowest.date)}.`,
      urgency: "high",
    };
  } else if (daysBelowMin > 3) {
    primaryRecommendation = {
      action: "Restructure your plan to reduce days below your safety net",
      reason: `${daysBelowMin} days are forecast below your minimum balance this period.`,
      urgency: "high",
    };
  } else if (paceStatus === "running-ahead" && isFrontLoadedBills) {
    const daysLeft = Math.max(1, periodDaysTotal - daysElapsedInPeriod);
    const weeksLeft = Math.max(1, daysLeft / 7);
    const discretionaryLeft = Math.max(0, discretionaryBudget - discretionaryActualSpend);
    const weeklyDiscTarget = Math.round(discretionaryLeft / weeksLeft);
    primaryRecommendation = {
      action: "Bills landed early — focus on flexible spend for the rest of the period",
      reason: `Your scheduled bills are front-loaded, which is normal. Aim to keep flexible spending under \u00a3${weeklyDiscTarget}/week to close on budget.`,
      urgency: "medium",
    };
  } else if (paceStatus === "running-ahead") {
    primaryRecommendation = {
      action: "Trim discretionary spending this week to get back on pace",
      reason: `Spending is \u00a3${Math.round(Math.abs(varianceToExpected))} ahead of what was expected by today based on your plan.`,
      urgency: "medium",
    };
  } else if (savingsThisPeriod === 0) {
    primaryRecommendation = {
      action: "Add a savings allocation to your plan to start building your safety net",
      reason: "No savings target is set — even a small amount compounds over time.",
      urgency: "medium",
    };
  } else {
    primaryRecommendation = {
      action: "Keep tracking your spending to close the period on target",
      reason: "Your plan is in good shape — staying consistent is the priority.",
      urgency: "low",
    };
  }

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
      actualsDaily,
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
    periodStage,
    weeklyPatterns: {
      week4OverspendDetected,
      overspendWeekIndex,
      weeklySpend,
      weeklyDiscretionarySpend,
    },
    spendingPace: {
      discretionaryActualSpend,
      discretionaryBudget,
      paceGap: discretionaryPaceGap,
      isFrontLoadedBills,
      scheduledBillFractionToDate,
      expectedSpentToDate,
      actualSpentToDate,
      varianceToExpected,
      tolerance: spendingTolerance,
      paceStatus,
      totalPlannedOutflows,
    },
    deltas,
    primaryRecommendation,
  };
}
