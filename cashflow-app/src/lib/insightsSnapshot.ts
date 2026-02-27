import {
  buildTimeline,
  generateEvents,
  getPeriod,
  getStartingBalance,
  getVarianceByCategory,
  minPoint,
  type TimelineRow,
  type VarianceByCategory,
  type VarianceSummary,
} from "@/lib/cashflowEngine";
import { suggestBillId } from "@/lib/billLinking";
import { formatMoney } from "@/lib/currency";
import { splitTokens, scoreTextMatch } from "@/lib/textUtils";
import type { CashflowCategory, Plan, Transaction } from "@/data/plan";
import { dayDiff, clamp, average, stdDev } from "@/lib/dateUtils";

// ─── Named constants ─────────────────────────────────────────────────────────

const SERIES_COLORS = {
  income: "#22c55e",
  spending: "#f97316",
  savings: "#a855f7",
  balance: "#3b82f6",
} as const;

const FORECAST_OPTIMISTIC_FACTOR = 1.05;
const FORECAST_PESSIMISTIC_FACTOR = 0.95;
const VARIABLE_CATEGORIES = new Set<CashflowCategory>(["allowance", "other", "buffer"]);

export type PeriodStats = {
  period: ReturnType<typeof getPeriod>;
  events: ReturnType<typeof generateEvents>;
  transactions: Transaction[];
  budgetIncome: number;
  budgetOutflows: number;
  budgetSavings: number;
  budgetSpending: number;
  budgetLeftover: number;
  actualIncome: number;
  actualSavings: number;
  actualSpending: number;
  actualLeftover: number;
};

export type ForecastScenario = {
  id: string;
  label: string;
  income: number;
  spending: number;
  savings: number;
  note: string;
  leftover: number;
  endBalance: number;
  bufferDelta: number;
};

export type CategoryData = { name: string; value: number };
export type SpendingDataPoint = { date: string; spending: number; income: number };

export type PeakInfo = { index: number; value: number };

export type BillVarianceRow = {
  id: string;
  label: string;
  budget: number;
  actual: number;
  variance: number;
};

export type MerchantRow = { label: string; total: number; delta: number };
export type CategoryChange = { category: CashflowCategory; delta: number };
export type LabelChange = { label: string; delta: number };
export type IncomeSourceChanges = { newSources: string[]; missingSources: string[] } | null;
export type IncomeSplit = { reliable: number; irregular: number };
export type SeriesCard = {
  key: string;
  label: string;
  values: number[];
  stroke: string;
  fill: string;
};
export type Scorecard = { id: number; label: string; status: "red" | "amber" | "green"; leftover: number };

export type PeriodHighlights = {
  incomePeak: PeakInfo;
  spendingPeak: PeakInfo;
  bestLeftover: PeakInfo;
  worstLeftover: PeakInfo;
};

export type InsightsSnapshot = {
  sortedPeriods: Plan["periods"];
  basePeriodId: number;
  comparePeriodId: number | null;
  asOfDate: string;
  basePeriod: ReturnType<typeof getPeriod>;
  comparePeriod: ReturnType<typeof getPeriod> | null;
  baseStats: PeriodStats;
  compareStats: PeriodStats | null;
  startingBalance: number;
  baseTimeline: TimelineRow[];
  endBalance: number;
  lowestPoint: ReturnType<typeof minPoint>;
  riskDays: number;
  firstRisk?: TimelineRow;
  periodDays: number;
  daysElapsed: number;
  timeProgress: number;
  incomeProgress: number;
  spendingProgress: number;
  savingsProgress: number;
  projectedIncome: number;
  projectedSpending: number;
  projectedSavings: number;
  projectedLeftover: number;
  forecastScenarios: ForecastScenario[];
  varianceByCategory: VarianceByCategory;
  overspentCategories: VarianceSummary[];
  variableCap: number;
  variableSpend: number;
  variableDelta: number;
  overspendItems: Transaction[];
  billVariance: BillVarianceRow[];
  merchantRows: MerchantRow[];
  categoryChanges: CategoryChange[];
  labelChanges: LabelChange[];
  incomeSourceChanges: IncomeSourceChanges;
  incomeSplit: IncomeSplit;
  allStats: PeriodStats[];
  incomeSeries: number[];
  spendingSeries: number[];
  savingsSeries: number[];
  leftoverSeries: number[];
  seriesCards: SeriesCard[];
  incomeAverage: number;
  incomeVolatility: number;
  incomeCv: number;
  hasIncomeData: boolean;
  stabilityScore: number | null;
  savingsStreak: number;
  savingsRate: number;
  scorecards: Scorecard[];
  recommendations: string[];
  categoryChartData: CategoryData[];
  periodTrendData: SpendingDataPoint[];
  periodHighlights: PeriodHighlights;
};

// ─── Private sub-function return types ───────────────────────────────────────

type PeriodTimelines = {
  sortedPeriods: Plan["periods"];
  comparePeriodId: number | null;
  basePeriod: ReturnType<typeof getPeriod>;
  comparePeriod: ReturnType<typeof getPeriod> | null;
  baseStats: PeriodStats;
  compareStats: PeriodStats | null;
  startingBalance: number;
  baseTimeline: TimelineRow[];
  endBalance: number;
  lowestPoint: ReturnType<typeof minPoint>;
  riskDays: number;
  firstRisk?: TimelineRow;
  periodDays: number;
  daysElapsed: number;
  timeProgress: number;
  incomeProgress: number;
  spendingProgress: number;
  savingsProgress: number;
};

type ProjectionScenarios = {
  projectedIncome: number;
  projectedSpending: number;
  projectedSavings: number;
  projectedLeftover: number;
  forecastScenarios: ForecastScenario[];
};

type VarianceAnalysis = {
  varianceByCategory: VarianceByCategory;
  overspentCategories: VarianceSummary[];
  variableCap: number;
  variableSpend: number;
  variableDelta: number;
  overspendItems: Transaction[];
  billVariance: BillVarianceRow[];
};

type MerchantAnalysis = {
  merchantRows: MerchantRow[];
  categoryChanges: CategoryChange[];
  labelChanges: LabelChange[];
};

type IncomeAnalysis = {
  incomeSourceChanges: IncomeSourceChanges;
  incomeSplit: IncomeSplit;
};

type TrendSeries = {
  allStats: PeriodStats[];
  incomeSeries: number[];
  spendingSeries: number[];
  savingsSeries: number[];
  leftoverSeries: number[];
  seriesCards: SeriesCard[];
  incomeAverage: number;
  incomeVolatility: number;
  incomeCv: number;
  hasIncomeData: boolean;
  stabilityScore: number | null;
  savingsStreak: number;
  savingsRate: number;
  categoryChartData: CategoryData[];
  periodTrendData: SpendingDataPoint[];
  periodHighlights: PeriodHighlights;
};

const incomeStopWords = new Set(["income", "salary", "pay", "payment", "wage"]);

function suggestIncomeRuleId(label: string, notes: string, rules: Plan["incomeRules"]) {
  if (!label && !notes) return "";
  let bestId = "";
  let bestScore = 0;
  const hay = `${label} ${notes ?? ""}`.trim();

  rules.forEach((rule) => {
    if (!rule.enabled) return;
    const labelBase = rule.label.replace(/income/gi, "").trim();
    const tokens = Array.from(
      new Set(
        [labelBase, rule.id]
          .map((value) => splitTokens(value))
          .flat()
          .filter((token) => token.length >= 2 && !incomeStopWords.has(token))
      )
    );
    const score = scoreTextMatch(hay, tokens).score;
    if (score > bestScore) {
      bestScore = score;
      bestId = rule.id;
    }
  });

  return bestScore > 0 ? bestId : "";
}

function getIncomeSourceKey(txn: Transaction, rules: Plan["incomeRules"]) {
  if (txn.linkedRuleId) return `rule:${txn.linkedRuleId}`;
  const suggested = suggestIncomeRuleId(txn.label, txn.notes ?? "", rules);
  if (suggested) return `rule:${suggested}`;
  return `label:${txn.label || "Unlabeled"}`;
}

function mapTotalsByCategory(transactions: Transaction[], filter: (txn: Transaction) => boolean) {
  const map = new Map<CashflowCategory, number>();
  transactions.filter(filter).forEach((txn) => {
    map.set(txn.category, (map.get(txn.category) ?? 0) + txn.amount);
  });
  return map;
}

function mapTotalsByLabel(transactions: Transaction[], filter: (txn: Transaction) => boolean) {
  const map = new Map<string, number>();
  transactions.filter(filter).forEach((txn) => {
    const key = txn.label || "Unlabeled";
    map.set(key, (map.get(key) ?? 0) + txn.amount);
  });
  return map;
}

function buildStats(plan: Plan, periodId: number): PeriodStats {
  const period = getPeriod(plan, periodId);
  const events = generateEvents(plan, periodId);
  const transactions = plan.transactions.filter(
    (t) => t.date >= period.start && t.date <= period.end
  );

  const budgetIncome = events.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const budgetOutflows = events.filter((e) => e.type === "outflow").reduce((sum, e) => sum + e.amount, 0);
  const budgetSavings = events
    .filter((e) => e.type === "outflow" && e.category === "savings")
    .reduce((sum, e) => sum + e.amount, 0);
  const budgetSpending = budgetOutflows - budgetSavings;
  const budgetLeftover = budgetIncome - budgetOutflows;

  const actualIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const actualSavings = transactions.filter((t) => t.category === "savings").reduce((sum, t) => sum + t.amount, 0);
  const actualSpending = transactions
    .filter((t) => t.type === "outflow" && t.category !== "savings")
    .reduce((sum, t) => sum + t.amount, 0);
  const actualLeftover = actualIncome - actualSpending - actualSavings;

  return {
    period,
    events,
    transactions,
    budgetIncome,
    budgetOutflows,
    budgetSavings,
    budgetSpending,
    budgetLeftover,
    actualIncome,
    actualSavings,
    actualSpending,
    actualLeftover,
  };
}

function indexOfMax(values: number[]): PeakInfo {
  if (!values.length) return { index: 0, value: 0 };
  let max = values[0];
  let idx = 0;
  values.forEach((v, i) => {
    if (v > max) {
      max = v;
      idx = i;
    }
  });
  return { index: idx, value: max };
}

function indexOfMin(values: number[]): PeakInfo {
  if (!values.length) return { index: 0, value: 0 };
  let min = values[0];
  let idx = 0;
  values.forEach((v, i) => {
    if (v < min) {
      min = v;
      idx = i;
    }
  });
  return { index: idx, value: min };
}

// ─── Private sub-functions ────────────────────────────────────────────────────

/** Builds budget + actuals timelines for the selected and compare periods. */
function buildPeriodTimelines(
  plan: Plan,
  basePeriodId: number,
  rawCompareId: "auto" | number | null
): PeriodTimelines {
  const sortedPeriods = [...plan.periods].sort((a, b) => a.id - b.id);
  const baseStats = buildStats(plan, basePeriodId);
  const basePeriod = baseStats.period;

  const defaultCompareId = (() => {
    const idx = sortedPeriods.findIndex((p) => p.id === basePeriod.id);
    if (idx > 0) return sortedPeriods[idx - 1].id;
    return null;
  })();
  const comparePeriodId = rawCompareId === "auto" ? defaultCompareId : rawCompareId;
  const compareStats = comparePeriodId ? buildStats(plan, comparePeriodId) : null;
  const comparePeriod = compareStats ? compareStats.period : null;

  const startingBalance = getStartingBalance(plan, basePeriod.id);
  const baseTimeline = buildTimeline(plan, basePeriod.id, startingBalance);
  const endBalance = baseTimeline.length
    ? baseTimeline[baseTimeline.length - 1].balance
    : plan.setup.startingBalance;
  const lowestPoint = minPoint(baseTimeline);
  const riskDays = baseTimeline.filter((row) => row.balance < plan.setup.expectedMinBalance).length;
  const firstRisk = baseTimeline.find((row) => row.balance < plan.setup.expectedMinBalance);

  const periodDays = dayDiff(basePeriod.start, basePeriod.end) + 1;
  const daysElapsedRaw = dayDiff(basePeriod.start, plan.setup.asOfDate) + 1;
  const daysElapsed = clamp(daysElapsedRaw, 0, periodDays);
  const timeProgress = periodDays > 0 ? daysElapsed / periodDays : 0;

  const incomeProgress = baseStats.budgetIncome > 0 ? baseStats.actualIncome / baseStats.budgetIncome : 0;
  const spendingProgress = baseStats.budgetSpending > 0 ? baseStats.actualSpending / baseStats.budgetSpending : 0;
  const savingsProgress = baseStats.budgetSavings > 0 ? baseStats.actualSavings / baseStats.budgetSavings : 0;

  return {
    sortedPeriods,
    comparePeriodId: comparePeriodId ?? null,
    basePeriod,
    comparePeriod,
    baseStats,
    compareStats,
    startingBalance,
    baseTimeline,
    endBalance,
    lowestPoint,
    riskDays,
    firstRisk,
    periodDays,
    daysElapsed,
    timeProgress,
    incomeProgress,
    spendingProgress,
    savingsProgress,
  };
}

/** Computes best/base/worst projection scenarios. */
function computeProjections(
  baseStats: PeriodStats,
  timeProgress: number,
  startingBalance: number,
  expectedMinBalance: number
): ProjectionScenarios {
  const projectedIncome = timeProgress > 0 ? baseStats.actualIncome / timeProgress : baseStats.actualIncome;
  const projectedSpending = timeProgress > 0 ? baseStats.actualSpending / timeProgress : baseStats.actualSpending;
  const projectedSavings = timeProgress > 0 ? baseStats.actualSavings / timeProgress : baseStats.actualSavings;
  const projectedLeftover = projectedIncome - projectedSpending - projectedSavings;

  const forecastScenarios: ForecastScenario[] = [
    {
      id: "conservative",
      label: "Conservative",
      income: projectedIncome * FORECAST_PESSIMISTIC_FACTOR,
      spending: projectedSpending * FORECAST_OPTIMISTIC_FACTOR,
      savings: projectedSavings,
      note: "Income -5%, spending +5%",
      leftover: 0,
      endBalance: 0,
      bufferDelta: 0,
    },
    {
      id: "pace",
      label: "Current pace",
      income: projectedIncome,
      spending: projectedSpending,
      savings: projectedSavings,
      note: "Based on actual pace so far",
      leftover: 0,
      endBalance: 0,
      bufferDelta: 0,
    },
    {
      id: "optimistic",
      label: "Optimistic",
      income: projectedIncome * FORECAST_OPTIMISTIC_FACTOR,
      spending: projectedSpending * FORECAST_PESSIMISTIC_FACTOR,
      savings: projectedSavings,
      note: "Income +5%, spending -5%",
      leftover: 0,
      endBalance: 0,
      bufferDelta: 0,
    },
  ].map((scenario) => {
    const leftover = scenario.income - scenario.spending - scenario.savings;
    const end = startingBalance + leftover;
    return { ...scenario, leftover, endBalance: end, bufferDelta: end - expectedMinBalance };
  });

  return { projectedIncome, projectedSpending, projectedSavings, projectedLeftover, forecastScenarios };
}

/** Computes category-level and total variance between budget and actuals, plus bill variance. */
function computeVarianceAnalysis(plan: Plan, timelines: PeriodTimelines): VarianceAnalysis {
  const { baseStats } = timelines;
  const varianceByCategory = getVarianceByCategory(plan, timelines.basePeriod.id);

  const overspentCategories = Object.values(varianceByCategory)
    .filter((v) => v && v.category !== "income" && v.category !== "savings" && v.status === "over")
    .map((v) => v as VarianceSummary);

  const variableSpend = baseStats.transactions
    .filter((t) => t.type === "outflow" && VARIABLE_CATEGORIES.has(t.category))
    .reduce((sum, t) => sum + t.amount, 0);
  const variableCap = plan.setup.variableCap;
  const variableDelta = variableSpend - variableCap;

  const overspendItems = (() => {
    const categories = new Set(overspentCategories.map((c) => c.category));
    return baseStats.transactions
      .filter((t) => t.type === "outflow" && categories.has(t.category))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  })();

  const billVariance = (() => {
    const events = generateEvents(plan, timelines.basePeriod.id);
    const map = new Map<string, { id: string; label: string; budget: number; actual: number }>();
    plan.bills.forEach((bill) =>
      map.set(bill.id, { id: bill.id, label: bill.label, budget: 0, actual: 0 })
    );
    events.forEach((event) => {
      if (event.type !== "outflow" || !event.sourceId) return;
      const entry = map.get(event.sourceId);
      if (entry) entry.budget += event.amount;
    });
    baseStats.transactions.forEach((txn) => {
      if (txn.type !== "outflow") return;
      const matched = txn.linkedBillId || suggestBillId(txn.label, txn.notes ?? "", plan.bills);
      if (!matched) return;
      const entry = map.get(matched);
      if (entry) entry.actual += txn.amount;
    });
    return Array.from(map.values())
      .map((row) => ({ ...row, variance: row.actual - row.budget }))
      .filter((row) => row.budget > 0 || row.actual > 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 6);
  })();

  return { varianceByCategory, overspentCategories, variableCap, variableSpend, variableDelta, overspendItems, billVariance };
}

/** Computes top merchants and per-merchant spending totals, plus category/label changes vs compare period. */
function computeMerchantAnalysis(
  baseStats: PeriodStats,
  compareStats: PeriodStats | null
): MerchantAnalysis {
  const merchantRows = (() => {
    const baseMap = mapTotalsByLabel(
      baseStats.transactions,
      (t) => t.type === "outflow" && t.category !== "savings"
    );
    const compareMap = compareStats
      ? mapTotalsByLabel(compareStats.transactions, (t) => t.type === "outflow" && t.category !== "savings")
      : new Map<string, number>();
    return Array.from(baseMap.entries())
      .map(([label, total]) => ({ label, total, delta: total - (compareMap.get(label) ?? 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  })();

  const categoryChanges: CategoryChange[] = (() => {
    if (!compareStats) return [];
    const baseMap = mapTotalsByCategory(
      baseStats.transactions,
      (t) => t.type === "outflow" && t.category !== "savings"
    );
    const compareMap = mapTotalsByCategory(
      compareStats.transactions,
      (t) => t.type === "outflow" && t.category !== "savings"
    );
    const categories = new Set([...baseMap.keys(), ...compareMap.keys()]);
    return Array.from(categories)
      .map((category) => ({ category, delta: (baseMap.get(category) ?? 0) - (compareMap.get(category) ?? 0) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
  })();

  const labelChanges: LabelChange[] = (() => {
    if (!compareStats) return [];
    const baseMap = mapTotalsByLabel(
      baseStats.transactions,
      (t) => t.type === "outflow" && t.category !== "savings"
    );
    const compareMap = mapTotalsByLabel(
      compareStats.transactions,
      (t) => t.type === "outflow" && t.category !== "savings"
    );
    const labels = new Set([...baseMap.keys(), ...compareMap.keys()]);
    return Array.from(labels)
      .map((label) => ({ label, delta: (baseMap.get(label) ?? 0) - (compareMap.get(label) ?? 0) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
  })();

  return { merchantRows, categoryChanges, labelChanges };
}

/** Computes income source breakdown and rule matching. */
function computeIncomeAnalysis(
  plan: Plan,
  baseStats: PeriodStats,
  compareStats: PeriodStats | null
): IncomeAnalysis {
  const incomeSourceChanges: IncomeSourceChanges = (() => {
    if (!compareStats) return null;
    const ruleMap = new Map(plan.incomeRules.map((rule) => [rule.id, rule.label]));
    const baseSources = baseStats.transactions
      .filter((t) => t.type === "income")
      .map((t) => getIncomeSourceKey(t, plan.incomeRules));
    const compareSources = compareStats.transactions
      .filter((t) => t.type === "income")
      .map((t) => getIncomeSourceKey(t, plan.incomeRules));
    const baseSet = new Set(baseSources);
    const compareSet = new Set(compareSources);
    const newSources = Array.from(baseSet).filter((key) => !compareSet.has(key));
    const missingSources = Array.from(compareSet).filter((key) => !baseSet.has(key));
    const formatKey = (key: string) => {
      if (key.startsWith("rule:")) {
        const id = key.replace("rule:", "");
        return ruleMap.get(id) ?? id;
      }
      return key.replace("label:", "");
    };
    return {
      newSources: newSources.map(formatKey).slice(0, 5),
      missingSources: missingSources.map(formatKey).slice(0, 5),
    };
  })();

  const incomeSplit: IncomeSplit = (() => {
    const reliable = baseStats.transactions
      .filter((t) => t.type === "income")
      .map((t) => ({
        txn: t,
        ruleId: getIncomeSourceKey(t, plan.incomeRules).startsWith("rule:")
          ? getIncomeSourceKey(t, plan.incomeRules).replace("rule:", "")
          : "",
      }))
      .filter((entry) => Boolean(entry.ruleId))
      .reduce((sum, entry) => sum + entry.txn.amount, 0);
    const irregular = baseStats.actualIncome - reliable;
    return { reliable, irregular };
  })();

  return { incomeSourceChanges, incomeSplit };
}

/** Builds the multi-period trend series for charts, plus income analytics and savings metrics. */
function buildTrendSeries(plan: Plan, baseStats: PeriodStats): TrendSeries {
  const sortedPeriods = [...plan.periods].sort((a, b) => a.id - b.id);
  const allStats = sortedPeriods.map((p) => buildStats(plan, p.id));

  const incomeSeries = allStats.map((s) => s.actualIncome);
  const spendingSeries = allStats.map((s) => s.actualSpending);
  const savingsSeries = allStats.map((s) => s.actualSavings);
  const leftoverSeries = allStats.map((s) => s.actualLeftover);

  const seriesCards: SeriesCard[] = [
    { key: "income", label: "Income", values: incomeSeries, stroke: SERIES_COLORS.income, fill: SERIES_COLORS.income },
    { key: "spending", label: "Spending", values: spendingSeries, stroke: SERIES_COLORS.spending, fill: SERIES_COLORS.spending },
    { key: "savings", label: "Savings", values: savingsSeries, stroke: SERIES_COLORS.savings, fill: SERIES_COLORS.savings },
    { key: "leftover", label: "Leftover", values: leftoverSeries, stroke: SERIES_COLORS.balance, fill: SERIES_COLORS.balance },
  ];

  const incomePeak = indexOfMax(incomeSeries);
  const spendingPeak = indexOfMax(spendingSeries);
  const bestLeftover = indexOfMax(leftoverSeries);
  const worstLeftover = indexOfMin(leftoverSeries);
  const periodHighlights: PeriodHighlights = { incomePeak, spendingPeak, bestLeftover, worstLeftover };

  const incomeAverage = average(incomeSeries);
  const incomeVolatility = stdDev(incomeSeries);
  const incomeCv = incomeAverage > 0 ? incomeVolatility / incomeAverage : 0;
  const hasIncomeData = incomeSeries.some((v) => v > 0);
  const stabilityScore = hasIncomeData ? Math.max(0, Math.round(100 - incomeCv * 100)) : null;

  const savingsStreak = (() => {
    let streak = 0;
    for (let idx = allStats.length - 1; idx >= 0; idx -= 1) {
      const stat = allStats[idx];
      if (stat.actualSavings >= stat.budgetSavings && stat.budgetSavings > 0) {
        streak += 1;
      } else if (stat.budgetSavings > 0) {
        break;
      }
    }
    return streak;
  })();

  const savingsRate = baseStats.actualIncome > 0 ? baseStats.actualSavings / baseStats.actualIncome : 0;

  const categoryChartData: CategoryData[] = Array.from(
    mapTotalsByCategory(baseStats.transactions, (t) => t.type === "outflow" && t.category !== "savings").entries()
  )
    .map(([category, value]) => ({
      name: category.charAt(0).toUpperCase() + category.slice(1),
      value,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const periodTrendData: SpendingDataPoint[] = allStats.map((stats, idx) => ({
    date: sortedPeriods[idx]?.label || `P${idx + 1}`,
    spending: stats.actualSpending,
    income: stats.actualIncome,
  }));

  return {
    allStats,
    incomeSeries,
    spendingSeries,
    savingsSeries,
    leftoverSeries,
    seriesCards,
    incomeAverage,
    incomeVolatility,
    incomeCv,
    hasIncomeData,
    stabilityScore,
    savingsStreak,
    savingsRate,
    categoryChartData,
    periodTrendData,
    periodHighlights,
  };
}

/** Builds health scorecards per period. */
function computeScorecards(plan: Plan, allStats: PeriodStats[]): Scorecard[] {
  const sortedPeriods = [...plan.periods].sort((a, b) => a.id - b.id);
  return sortedPeriods.map((p) => {
    const stats = allStats.find((s) => s.period.id === p.id) ?? buildStats(plan, p.id);
    const start = getStartingBalance(plan, p.id);
    const rows = buildTimeline(plan, p.id, start);
    const minBal = minPoint(rows)?.balance ?? start;
    const minOk = minBal >= plan.setup.expectedMinBalance;
    const savingsOk = stats.budgetSavings === 0 ? true : stats.actualSavings >= stats.budgetSavings;
    const leftoverOk = stats.actualLeftover >= 0;
    const issues = [!minOk, !savingsOk, !leftoverOk].filter(Boolean).length;
    const status: Scorecard["status"] =
      issues >= 2 || !leftoverOk ? "red" : issues === 1 ? "amber" : "green";
    return { id: p.id, label: p.label, status, leftover: stats.actualLeftover };
  });
}

/** Generates spending recommendations based on actuals vs budget. */
function generateRecommendations(
  plan: Plan,
  timelines: PeriodTimelines,
  variance: VarianceAnalysis
): string[] {
  const { baseStats, timeProgress, endBalance } = timelines;
  const { variableDelta } = variance;
  const items: string[] = [];

  if (baseStats.actualSpending > baseStats.budgetSpending + 1) {
    items.push(`Reduce spending by ${formatMoney(baseStats.actualSpending - baseStats.budgetSpending)} to meet budget.`);
  }
  if (baseStats.actualSavings + 1 < baseStats.budgetSavings) {
    items.push(`Increase savings transfers by ${formatMoney(baseStats.budgetSavings - baseStats.actualSavings)} to hit target.`);
  }
  if (variableDelta > 0) {
    items.push(`Trim variable spend by ${formatMoney(variableDelta)} to stay within the cap.`);
  }
  if (timeProgress > 0.1 && baseStats.actualIncome < baseStats.budgetIncome * timeProgress) {
    items.push("Income is behind pace. Consider updating expected income or adding a supplemental stream.");
  }
  if (endBalance < plan.setup.expectedMinBalance) {
    items.push("Projected balance dips below your safe minimum. Review large outflows or increase buffer.");
  }
  if (!items.length) {
    items.push("Everything looks on track. Keep your current cadence.");
  }
  return items.slice(0, 4);
}

// ─── Public orchestrator ─────────────────────────────────────────────────────

export function buildInsightsSnapshot(
  plan: Plan,
  basePeriodId: number,
  comparePeriodId: "auto" | number | null
): InsightsSnapshot {
  const timelines = buildPeriodTimelines(plan, basePeriodId, comparePeriodId);
  const projections = computeProjections(
    timelines.baseStats,
    timelines.timeProgress,
    timelines.startingBalance,
    plan.setup.expectedMinBalance
  );
  const variance = computeVarianceAnalysis(plan, timelines);
  const merchants = computeMerchantAnalysis(timelines.baseStats, timelines.compareStats);
  const income = computeIncomeAnalysis(plan, timelines.baseStats, timelines.compareStats);
  const trends = buildTrendSeries(plan, timelines.baseStats);
  const scorecards = computeScorecards(plan, trends.allStats);
  const recommendations = generateRecommendations(plan, timelines, variance);

  return {
    basePeriodId,
    asOfDate: plan.setup.asOfDate,
    ...timelines,
    ...projections,
    ...variance,
    ...merchants,
    ...income,
    ...trends,
    scorecards,
    recommendations,
  };
}
