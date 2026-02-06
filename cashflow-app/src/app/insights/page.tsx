"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildTimeline,
  generateEvents,
  getPeriod,
  getStartingBalance,
  getVarianceByCategory,
  minPoint,
} from "@/lib/cashflowEngine";
import { loadPlan } from "@/lib/storage";
import { suggestBillId } from "@/lib/billLinking";
import { downloadPlanPdf } from "@/lib/planIo";
import SidebarNav from "@/components/SidebarNav";
import { CategoryBreakdownChart, SpendingTrendChart } from "@/components/charts";
import type { CategoryData, SpendingDataPoint } from "@/components/charts";
import type { CashflowCategory, Plan, Transaction } from "@/data/plan";

function money(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function formatDelta(value: number) {
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${money(Math.abs(value))}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toUtcDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function dayDiff(startISO: string, endISO: string) {
  const ms = toUtcDay(endISO) - toUtcDay(startISO);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return total / values.length;
}

function stdDev(values: number[]) {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance =
    values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

const incomeStopWords = new Set(["income", "salary", "pay", "payment", "wage"]);

function scoreRuleMatch(hay: string, tokens: string[]) {
  const normalized = normalizeText(hay);
  if (!normalized) return 0;
  const wordSet = new Set(splitTokens(normalized));
  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (wordSet.has(token)) {
      score += 2;
    } else if (normalized.includes(token)) {
      score += 1;
    }
  }
  return score;
}

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
    const score = scoreRuleMatch(hay, tokens);
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

type PeriodStats = {
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

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="vn-card p-6">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  total,
  tone,
  hint,
}: {
  label: string;
  value: number;
  total: number;
  tone?: "good" | "warn" | "bad";
  hint?: string;
}) {
  const pct = total > 0 ? clamp(value / total, 0, 1) : 0;
  const color =
    tone === "good"
      ? "bg-[var(--gold)]"
      : tone === "bad"
        ? "bg-rose-500"
        : "bg-slate-400";
  return (
    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-semibold text-slate-700">{formatPercent(pct)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct * 100}%` }} />
      </div>
      {hint ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

function lastValue(values: number[]) {
  return values.length ? values[values.length - 1] : 0;
}

function deltaValue(values: number[]) {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[values.length - 2];
}

function indexOfMax(values: number[]) {
  if (values.length === 0) return { index: -1, value: 0 };
  let idx = 0;
  let max = values[0] ?? 0;
  values.forEach((value, i) => {
    if (value > max) {
      max = value;
      idx = i;
    }
  });
  return { index: idx, value: max };
}

function indexOfMin(values: number[]) {
  if (values.length === 0) return { index: -1, value: 0 };
  let idx = 0;
  let min = values[0] ?? 0;
  values.forEach((value, i) => {
    if (value < min) {
      min = value;
      idx = i;
    }
  });
  return { index: idx, value: min };
}

function periodLabelAt(periods: Plan["periods"], idx: number) {
  if (idx < 0 || idx >= periods.length) return "Unknown";
  return periods[idx]?.label ?? `P${idx + 1}`;
}

function Sparkline({
  values,
  stroke,
  fill,
}: {
  values: number[];
  stroke: string;
  fill: string;
}) {
  if (values.length === 0) return null;
  const width = 120;
  const height = 36;
  const padding = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = values.map((value, idx) => {
    const x =
      padding + (values.length === 1 ? 0 : (idx / (values.length - 1)) * (width - padding * 2));
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return { x, y };
  });
  const points = coords.map((pt) => `${pt.x},${pt.y}`).join(" ");
  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
      <polygon points={areaPoints} fill={fill} opacity={0.2} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function downloadTextFile(content: string, filename: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/\"/g, "\"\"")}"`;
  }
  return value;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="vn-card p-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default function InsightsPage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [basePeriodId, setBasePeriodId] = useState<number>(() => loadPlan().setup.selectedPeriodId);
  const [comparePeriodId, setComparePeriodId] = useState<"auto" | number | null>("auto");

  useEffect(() => {
    const refresh = () => setPlan(loadPlan());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const sortedPeriods = useMemo(
    () => [...plan.periods].sort((a, b) => a.id - b.id),
    [plan.periods]
  );
  const baseStats = useMemo(() => buildStats(plan, basePeriodId), [plan, basePeriodId]);
  const defaultCompareId = useMemo(() => {
    const idx = sortedPeriods.findIndex((p) => p.id === baseStats.period.id);
    if (idx > 0) return sortedPeriods[idx - 1].id;
    return null;
  }, [sortedPeriods, baseStats.period.id]);
  const resolvedCompareId = comparePeriodId === "auto" ? defaultCompareId : comparePeriodId;
  const compareStats = useMemo(() => {
    if (!resolvedCompareId) return null;
    return buildStats(plan, resolvedCompareId);
  }, [plan, resolvedCompareId]);

  const startingBalance = useMemo(
    () => getStartingBalance(plan, baseStats.period.id),
    [plan, baseStats.period.id]
  );
  const baseTimeline = useMemo(
    () => buildTimeline(plan, baseStats.period.id, startingBalance),
    [plan, baseStats.period.id, startingBalance]
  );

  const endBalance = baseTimeline.length
    ? baseTimeline[baseTimeline.length - 1].balance
    : plan.setup.startingBalance;
  const lowestPoint = minPoint(baseTimeline);
  const riskDays = baseTimeline.filter((row) => row.balance < plan.setup.expectedMinBalance).length;
  const firstRisk = baseTimeline.find((row) => row.balance < plan.setup.expectedMinBalance);

  const periodDays = dayDiff(baseStats.period.start, baseStats.period.end) + 1;
  const daysElapsedRaw = dayDiff(baseStats.period.start, plan.setup.asOfDate) + 1;
  const daysElapsed = clamp(daysElapsedRaw, 0, periodDays);
  const timeProgress = periodDays > 0 ? daysElapsed / periodDays : 0;

  const incomeProgress = baseStats.budgetIncome > 0 ? baseStats.actualIncome / baseStats.budgetIncome : 0;
  const spendingProgress = baseStats.budgetSpending > 0 ? baseStats.actualSpending / baseStats.budgetSpending : 0;
  const savingsProgress = baseStats.budgetSavings > 0 ? baseStats.actualSavings / baseStats.budgetSavings : 0;

  const projectedIncome = timeProgress > 0 ? baseStats.actualIncome / timeProgress : baseStats.actualIncome;
  const projectedSpending = timeProgress > 0 ? baseStats.actualSpending / timeProgress : baseStats.actualSpending;
  const projectedSavings = timeProgress > 0 ? baseStats.actualSavings / timeProgress : baseStats.actualSavings;
  const projectedLeftover = projectedIncome - projectedSpending - projectedSavings;

  const forecastScenarios = useMemo(() => {
    const scenarios = [
      {
        id: "conservative",
        label: "Conservative",
        income: projectedIncome * 0.95,
        spending: projectedSpending * 1.05,
        savings: projectedSavings,
        note: "Income -5%, spending +5%",
      },
      {
        id: "pace",
        label: "Current pace",
        income: projectedIncome,
        spending: projectedSpending,
        savings: projectedSavings,
        note: "Based on actual pace so far",
      },
      {
        id: "optimistic",
        label: "Optimistic",
        income: projectedIncome * 1.05,
        spending: projectedSpending * 0.95,
        savings: projectedSavings,
        note: "Income +5%, spending -5%",
      },
    ];

    return scenarios.map((scenario) => {
      const leftover = scenario.income - scenario.spending - scenario.savings;
      const endBalance = startingBalance + leftover;
      return {
        ...scenario,
        leftover,
        endBalance,
        bufferDelta: endBalance - plan.setup.expectedMinBalance,
      };
    });
  }, [
    plan.setup.expectedMinBalance,
    projectedIncome,
    projectedSavings,
    projectedSpending,
    startingBalance,
  ]);

  const varianceByCategory = useMemo(
    () => getVarianceByCategory(plan, baseStats.period.id),
    [plan, baseStats.period.id]
  );

  const overspentCategories = useMemo(() => {
    return Object.values(varianceByCategory)
      .filter((v) => v && v.category !== "income" && v.category !== "savings" && v.status === "over")
      .map((v) => v!);
  }, [varianceByCategory]);

  const variableCategories = useMemo(
    () => new Set<CashflowCategory>(["allowance", "other", "buffer"]),
    []
  );
  const variableSpend = useMemo(
    () =>
      baseStats.transactions
        .filter((t) => t.type === "outflow" && variableCategories.has(t.category))
        .reduce((sum, t) => sum + t.amount, 0),
    [baseStats.transactions, variableCategories]
  );
  const variableDelta = variableSpend - plan.setup.variableCap;

  const overspendItems = useMemo(() => {
    const categories = new Set(overspentCategories.map((c) => c.category));
    return baseStats.transactions
      .filter((t) => t.type === "outflow" && categories.has(t.category))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [baseStats.transactions, overspentCategories]);

  const billVariance = useMemo(() => {
    const events = generateEvents(plan, baseStats.period.id);
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
      const matched =
        txn.linkedBillId || suggestBillId(txn.label, txn.notes ?? "", plan.bills);
      if (!matched) return;
      const entry = map.get(matched);
      if (entry) entry.actual += txn.amount;
    });

    return Array.from(map.values())
      .map((row) => ({ ...row, variance: row.actual - row.budget }))
      .filter((row) => row.budget > 0 || row.actual > 0)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 6);
  }, [baseStats.period.id, baseStats.transactions, plan]);

  const merchantRows = useMemo(() => {
    const baseMap = mapTotalsByLabel(
      baseStats.transactions,
      (t) => t.type === "outflow" && t.category !== "savings"
    );
    const compareMap = compareStats
      ? mapTotalsByLabel(
        compareStats.transactions,
        (t) => t.type === "outflow" && t.category !== "savings"
      )
      : new Map<string, number>();

    return Array.from(baseMap.entries())
      .map(([label, total]) => ({
        label,
        total,
        delta: total - (compareMap.get(label) ?? 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [baseStats.transactions, compareStats]);

  const categoryChanges = useMemo(() => {
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
      .map((category) => ({
        category,
        delta: (baseMap.get(category) ?? 0) - (compareMap.get(category) ?? 0),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
  }, [baseStats.transactions, compareStats]);

  const labelChanges = useMemo(() => {
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
      .map((label) => ({
        label,
        delta: (baseMap.get(label) ?? 0) - (compareMap.get(label) ?? 0),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
  }, [baseStats.transactions, compareStats]);

  const incomeSourceChanges = useMemo(() => {
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
  }, [baseStats.transactions, compareStats, plan.incomeRules]);

  const incomeSplit = useMemo(() => {
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
  }, [baseStats.actualIncome, baseStats.transactions, plan.incomeRules]);

  const allStats = useMemo(
    () => sortedPeriods.map((p) => buildStats(plan, p.id)),
    [plan, sortedPeriods]
  );

  const incomeSeries = useMemo(() => allStats.map((s) => s.actualIncome), [allStats]);
  const spendingSeries = useMemo(() => allStats.map((s) => s.actualSpending), [allStats]);
  const savingsSeries = useMemo(() => allStats.map((s) => s.actualSavings), [allStats]);
  const leftoverSeries = useMemo(() => allStats.map((s) => s.actualLeftover), [allStats]);

  const seriesCards = useMemo(
    () => [
      {
        key: "income",
        label: "Income",
        values: incomeSeries,
        stroke: "#22c55e",
        fill: "#22c55e",
      },
      {
        key: "spending",
        label: "Spending",
        values: spendingSeries,
        stroke: "#dc2626",
        fill: "#dc2626",
      },
      {
        key: "savings",
        label: "Savings",
        values: savingsSeries,
        stroke: "#3b82f6",
        fill: "#3b82f6",
      },
      {
        key: "leftover",
        label: "Leftover",
        values: leftoverSeries,
        stroke: "#fbbf24",
        fill: "#fbbf24",
      },
    ],
    [incomeSeries, spendingSeries, savingsSeries, leftoverSeries]
  );

  const incomePeak = useMemo(() => indexOfMax(incomeSeries), [incomeSeries]);
  const spendingPeak = useMemo(() => indexOfMax(spendingSeries), [spendingSeries]);
  const bestLeftover = useMemo(() => indexOfMax(leftoverSeries), [leftoverSeries]);
  const worstLeftover = useMemo(() => indexOfMin(leftoverSeries), [leftoverSeries]);

  const incomeAverage = average(incomeSeries);
  const incomeVolatility = stdDev(incomeSeries);
  const incomeCv = incomeAverage > 0 ? incomeVolatility / incomeAverage : 0;
  const stabilityScore = Math.max(0, Math.round(100 - incomeCv * 100));

  const savingsStreak = useMemo(() => {
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
  }, [allStats]);

  const savingsRate = baseStats.actualIncome > 0 ? baseStats.actualSavings / baseStats.actualIncome : 0;

  const scorecards = useMemo(() => {
    return sortedPeriods.map((p) => {
      const stats = allStats.find((s) => s.period.id === p.id) ?? buildStats(plan, p.id);
      const startingBalance = getStartingBalance(plan, p.id);
      const rows = buildTimeline(plan, p.id, startingBalance);
      const minBal = minPoint(rows)?.balance ?? startingBalance;
      const minOk = minBal >= plan.setup.expectedMinBalance;
      const savingsOk = stats.budgetSavings === 0 ? true : stats.actualSavings >= stats.budgetSavings;
      const leftoverOk = stats.actualLeftover >= 0;
      const issues = [!minOk, !savingsOk, !leftoverOk].filter(Boolean).length;
      const status = issues >= 2 || !leftoverOk ? "red" : issues === 1 ? "amber" : "green";
      return {
        id: p.id,
        label: p.label,
        status,
        leftover: stats.actualLeftover,
      };
    });
  }, [allStats, plan, sortedPeriods]);

  const recommendations = useMemo(() => {
    const items: string[] = [];
    if (baseStats.actualSpending > baseStats.budgetSpending + 1) {
      items.push(`Reduce spending by ${money(baseStats.actualSpending - baseStats.budgetSpending)} to meet budget.`);
    }
    if (baseStats.actualSavings + 1 < baseStats.budgetSavings) {
      items.push(`Increase savings transfers by ${money(baseStats.budgetSavings - baseStats.actualSavings)} to hit target.`);
    }
    if (variableDelta > 0) {
      items.push(`Trim variable spend by ${money(variableDelta)} to stay within the cap.`);
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
  }, [
    baseStats.actualIncome,
    baseStats.actualSavings,
    baseStats.actualSpending,
    baseStats.budgetIncome,
    baseStats.budgetSavings,
    baseStats.budgetSpending,
    endBalance,
    plan.setup.expectedMinBalance,
    timeProgress,
    variableDelta,
  ]);

  const categoryChartData: CategoryData[] = useMemo(() => {
    const categoryMap = mapTotalsByCategory(
      baseStats.transactions,
      (t) => t.type === "outflow" && t.category !== "savings"
    );
    return Array.from(categoryMap.entries())
      .map(([category, value]) => ({
        name: category.charAt(0).toUpperCase() + category.slice(1),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [baseStats.transactions]);

  const periodTrendData: SpendingDataPoint[] = useMemo(() => {
    return allStats.map((stats, idx) => ({
      date: sortedPeriods[idx]?.label || `P${idx + 1}`,
      spending: stats.actualSpending,
      income: stats.actualIncome,
    }));
  }, [allStats, sortedPeriods]);

  const basePeriod = baseStats.period;

  function handleExportSummary() {
    const rows = [
      ["Period", basePeriod.label],
      ["Period range", `${basePeriod.start} to ${basePeriod.end}`],
      ["Budget income", money(baseStats.budgetIncome)],
      ["Budget spending", money(baseStats.budgetSpending)],
      ["Budget savings", money(baseStats.budgetSavings)],
      ["Budget leftover", money(baseStats.budgetLeftover)],
      ["Actual income", money(baseStats.actualIncome)],
      ["Actual spending", money(baseStats.actualSpending)],
      ["Actual savings", money(baseStats.actualSavings)],
      ["Actual leftover", money(baseStats.actualLeftover)],
      ["Projected end balance", money(endBalance)],
      ["Lowest balance", lowestPoint ? money(lowestPoint.balance) : "0"],
      ["Risk days", String(riskDays)],
    ];

    const csv = [["Metric", "Value"], ...rows]
      .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
      .join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `vero-insights-${stamp}.csv`, "text/csv");
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={basePeriod.label} periodStart={basePeriod.start} periodEnd={basePeriod.end} />

          <section className="space-y-6">
            <header className="vn-card p-6">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Insights</div>
              <h1 className="text-2xl font-semibold text-slate-900">Insights</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Answers to the questions you normally ask about the period.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Base period</span>
                  <select
                    value={basePeriodId}
                    onChange={(e) => setBasePeriodId(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs text-slate-700"
                  >
                    {sortedPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>Compare to</span>
                  <select
                    value={comparePeriodId === "auto" ? "auto" : comparePeriodId ?? ""}
                    onChange={(e) =>
                      setComparePeriodId(
                        e.target.value === "auto"
                          ? "auto"
                          : e.target.value
                            ? Number(e.target.value)
                            : null
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="auto">Auto (previous)</option>
                    <option value="">None</option>
                    {sortedPeriods
                      .filter((p) => p.id !== basePeriod.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportSummary}
                    className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white"
                  >
                    Export summary (CSV)
                  </button>
                  <button
                    onClick={() => downloadPlanPdf(plan, baseStats.period.id)}
                    className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white"
                  >
                    Download PDF report
                  </button>
                </div>
              </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2">
              <SummaryCard label="Budget income" value={money(baseStats.budgetIncome)} />
              <SummaryCard label="Budget spending" value={money(baseStats.budgetSpending)} />
              <SummaryCard label="Savings target" value={money(baseStats.budgetSavings)} />
              <SummaryCard label="Planned leftover" value={money(baseStats.budgetLeftover)} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <SummaryCard label="Actual income" value={money(baseStats.actualIncome)} />
              <SummaryCard label="Actual spending" value={money(baseStats.actualSpending)} />
              <SummaryCard label="Actual savings" value={money(baseStats.actualSavings)} />
              <SummaryCard label="Actual leftover" value={money(baseStats.actualLeftover)} />
            </div>

            <CollapsibleSection title="1) Am I on track?" defaultOpen>
              <div className="grid gap-4 sm:grid-cols-2">
                <ProgressBar
                  label="Time into period"
                  value={daysElapsed}
                  total={periodDays}
                  tone="good"
                  hint={`Day ${daysElapsed} of ${periodDays}`}
                />
                <ProgressBar
                  label="Income pace"
                  value={baseStats.actualIncome}
                  total={baseStats.budgetIncome}
                  tone={incomeProgress >= timeProgress ? "good" : "warn"}
                  hint={`Actual ${money(baseStats.actualIncome)} vs budget ${money(baseStats.budgetIncome)}`}
                />
                <ProgressBar
                  label="Spending pace"
                  value={baseStats.actualSpending}
                  total={baseStats.budgetSpending}
                  tone={spendingProgress <= timeProgress ? "good" : "bad"}
                  hint={`Actual ${money(baseStats.actualSpending)} vs budget ${money(baseStats.budgetSpending)}`}
                />
                <ProgressBar
                  label="Savings pace"
                  value={baseStats.actualSavings}
                  total={baseStats.budgetSavings}
                  tone={savingsProgress >= timeProgress ? "good" : "warn"}
                  hint={`Actual ${money(baseStats.actualSavings)} vs target ${money(baseStats.budgetSavings)}`}
                />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Forecast end balance</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">{money(endBalance)}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Lowest point {lowestPoint ? money(lowestPoint.balance) : "0"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk days</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">
                    {riskDays === 0 ? "None" : `${riskDays} day(s)`}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {firstRisk ? `First risk on ${firstRisk.date}` : "Above safe minimum"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Projected leftover</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">
                    {formatDelta(projectedLeftover)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Based on current pace
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Safe minimum</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">
                    {money(plan.setup.expectedMinBalance)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {lowestPoint && lowestPoint.balance < plan.setup.expectedMinBalance
                      ? "Below minimum"
                      : "On track"}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Forecast scenarios</div>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {forecastScenarios.map((scenario) => {
                    const tone =
                      scenario.bufferDelta >= 0
                        ? "text-green-600"
                        : "text-rose-600";
                    return (
                      <div
                        key={scenario.id}
                        className="rounded-2xl border border-slate-200 bg-white/70 p-4"
                      >
                        <div className="text-sm font-semibold text-slate-900">{scenario.label}</div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{scenario.note}</div>
                        <div className="mt-3 text-xs uppercase tracking-wide text-slate-400">Projected leftover</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">
                          {money(scenario.leftover)}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-wide text-slate-400">End balance</div>
                        <div className={`mt-1 text-sm font-semibold ${tone}`}>
                          {money(scenario.endBalance)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="2) What changed vs last period?" defaultOpen>
              {compareStats ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Income change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {formatDelta(baseStats.actualIncome - compareStats.actualIncome)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Spending change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {formatDelta(baseStats.actualSpending - compareStats.actualSpending)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Savings change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {formatDelta(baseStats.actualSavings - compareStats.actualSavings)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Leftover change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900">
                        {formatDelta(baseStats.actualLeftover - compareStats.actualLeftover)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top category changes</div>
                      <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {categoryChanges.length === 0 ? (
                          <div className="text-slate-500 dark:text-slate-400">No category changes.</div>
                        ) : (
                          categoryChanges.map((item) => (
                            <div key={item.category} className="flex items-center justify-between">
                              <span className="capitalize">{item.category}</span>
                              <span className="font-semibold text-slate-900">{formatDelta(item.delta)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top merchant changes</div>
                      <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {labelChanges.length === 0 ? (
                          <div className="text-slate-500 dark:text-slate-400">No merchant changes.</div>
                        ) : (
                          labelChanges.map((item) => (
                            <div key={item.label} className="flex items-center justify-between">
                              <span>{item.label}</span>
                              <span className="font-semibold text-slate-900">{formatDelta(item.delta)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {incomeSourceChanges ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">New income sources</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {incomeSourceChanges.newSources.length === 0
                            ? <div className="text-slate-500 dark:text-slate-400">None this period.</div>
                            : incomeSourceChanges.newSources.map((source) => (
                              <div key={source}>{source}</div>
                            ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Missing income sources</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {incomeSourceChanges.missingSources.length === 0
                            ? <div className="text-slate-500 dark:text-slate-400">None missing.</div>
                            : incomeSourceChanges.missingSources.map((source) => (
                              <div key={source}>{source}</div>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">Select a comparison period to see changes.</div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="3) Where am I overspending?" defaultOpen>
              {categoryChartData.length > 0 && (
                <div className="mb-6 rounded-2xl bg-white/70 p-6 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">Spending by category</div>
                  <CategoryBreakdownChart data={categoryChartData} height={320} />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Variable cap</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">
                    {money(plan.setup.variableCap)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Actual {money(variableSpend)} ({formatDelta(variableDelta)})
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top overspent categories</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {overspentCategories.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No categories over budget.</div>
                    ) : (
                      overspentCategories.slice(0, 4).map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between">
                          <span className="capitalize">{cat.category}</span>
                          <span className="font-semibold text-slate-900">{formatDelta(cat.variance)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Biggest overspend items</div>
                <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {overspendItems.length === 0 ? (
                    <div className="text-slate-500 dark:text-slate-400">No overspend items.</div>
                  ) : (
                    overspendItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span>{item.label}</span>
                        <span className="font-semibold text-slate-900">{money(item.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Budget variance by bill</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {billVariance.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No bill variance data.</div>
                    ) : (
                      billVariance.map((row) => {
                        const tone = row.variance > 0 ? "text-rose-600" : "text-green-600";
                        return (
                          <div key={row.id} className="flex items-center justify-between gap-3">
                            <span className="truncate">{row.label}</span>
                            <span className={`font-semibold ${tone}`}>{formatDelta(row.variance)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top merchants</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {merchantRows.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No merchant spend recorded.</div>
                    ) : (
                      merchantRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <span className="truncate">{row.label}</span>
                          <span className="font-semibold text-slate-900">
                            {money(row.total)}
                            {compareStats ? (
                              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                                ({formatDelta(row.delta)} vs last)
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="4) How stable is my income?" defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                <SummaryCard label="Average income" value={money(incomeAverage)} />
                <SummaryCard label="Income volatility" value={money(incomeVolatility)} hint="Std dev across periods" />
                <SummaryCard label="Stability score" value={`${stabilityScore}/100`} hint="Higher is more stable" />
                <SummaryCard
                  label="Reliable vs irregular"
                  value={`${money(incomeSplit.reliable)} | ${money(incomeSplit.irregular)}`}
                  hint="Reliable (rules) | Irregular (unmatched)"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="5) How healthy are my savings?" defaultOpen>
              <div className="grid gap-4 md:grid-cols-2">
                <SummaryCard
                  label="Savings rate"
                  value={formatPercent(savingsRate)}
                  hint="Savings as a share of income"
                />
                <SummaryCard
                  label="Savings streak"
                  value={`${savingsStreak} period(s)`}
                  hint="Consecutive periods meeting target"
                />
                <SummaryCard
                  label="Savings delta"
                  value={formatDelta(baseStats.actualSavings - baseStats.budgetSavings)}
                  hint="Actual vs target"
                />
                <SummaryCard
                  label="Leftover delta"
                  value={formatDelta(baseStats.actualLeftover - baseStats.budgetLeftover)}
                  hint="Actual vs planned"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="6) What should I do next?" defaultOpen>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {recommendations.map((rec) => (
                  <div key={rec} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                    {rec}
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="7) How do periods compare overall?" defaultOpen>
              {periodTrendData.length > 1 && (
                <div className="mb-6 rounded-2xl bg-white/70 p-6 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">Income vs spending trends</div>
                  <SpendingTrendChart data={periodTrendData} showIncome={true} height={300} />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {seriesCards.map((series) => {
                  const last = lastValue(series.values);
                  const delta = deltaValue(series.values);
                  const deltaTone = delta >= 0 ? "text-green-600" : "text-rose-600";
                  return (
                    <div key={series.key} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{series.label}</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">{money(last)}</div>
                          <div className={`mt-1 text-xs ${deltaTone}`}>
                            {delta >= 0 ? "Up" : "Down"} {formatDelta(delta)} vs last period
                          </div>
                        </div>
                        <Sparkline values={series.values} stroke={series.stroke} fill={series.fill} />
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {series.values.length} period(s) tracked
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Period highlights</div>
                <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Highest income</span>
                    <span className="font-semibold text-slate-900">
                      {money(incomePeak.value)} ({periodLabelAt(sortedPeriods, incomePeak.index)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Highest spending</span>
                    <span className="font-semibold text-slate-900">
                      {money(spendingPeak.value)} ({periodLabelAt(sortedPeriods, spendingPeak.index)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Best leftover</span>
                    <span className="font-semibold text-slate-900">
                      {money(bestLeftover.value)} ({periodLabelAt(sortedPeriods, bestLeftover.index)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lowest leftover</span>
                    <span className="font-semibold text-slate-900">
                      {money(worstLeftover.value)} ({periodLabelAt(sortedPeriods, worstLeftover.index)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {scorecards.map((card) => {
                  const badge =
                    card.status === "green"
                      ? "bg-amber-100 text-green-700"
                      : card.status === "amber"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700";
                  return (
                    <div
                      key={card.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
                    >
                      <div className="font-semibold text-slate-900">{card.label}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-1 font-semibold ${badge}`}>
                          {card.status.toUpperCase()}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">Leftover {money(card.leftover)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
          </section>
        </div>
      </div>
    </main>
  );
}
