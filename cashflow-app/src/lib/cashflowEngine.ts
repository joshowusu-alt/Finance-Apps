import type {
  BillTemplate,
  CashflowEvent,
  CashflowOverride,
  IncomeRule,
  OutflowRule,
  Period,
  Plan,
  CashflowCategory,
  EventOverride,
  PeriodRuleOverride,
} from "@/data/plan";

export type TimelineRow = {
  date: string; // YYYY-MM-DD
  label: string;
  income: number;
  outflow: number;
  net: number;
  balance: number;
  warning: boolean;
};

export type VarianceSummary = {
  category: CashflowCategory;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: "under" | "over" | "neutral";
};

export type VarianceByCategory = {
  [key in CashflowCategory]?: VarianceSummary;
};

// NOTE: Module-level caches were removed (C1 fix) because WeakMap<Plan>
// can serve stale data when storage.ts mutates a cached Plan object in-place.
// React-level memoisation via useMemo in useDerived handles re-render efficiency.

function iso(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function clampDay(year: number, monthIndex: number, day: number) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(day, daysInMonth));
  return safeDay;
}

// N2: cur is mutated in-place via setDate, which is safe because iso() captures
// the value before mutation. parseISO uses Date(y, m-1, d) constructor arguments,
// avoiding UTC-vs-local issues. DST transitions are not a concern for date-only
// iteration since we only use the date component, not hours/minutes.
function eachDayInclusive(startISO: string, endISO: string) {
  const out: string[] = [];
  const cur = parseISO(startISO);
  const end = parseISO(endISO);
  while (cur.getTime() <= end.getTime()) {
    out.push(iso(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function eachMonthBetween(startISO: string, endISO: string) {
  const out: Array<{ year: number; month: number }> = [];
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur.getTime() <= end.getTime()) {
    out.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
}

function money(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getPeriod(plan: Plan, periodId: number): Period {
  const period = plan.periods.find((p) => p.id === periodId);
  return period ?? plan.periods[0];
}

export function getPeriodForDate(plan: Plan, dateISO: string): number | null {
  const t = parseISO(dateISO).getTime();
  for (const period of plan.periods) {
    const start = parseISO(period.start).getTime();
    const end = parseISO(period.end).getTime();
    if (t >= start && t <= end) return period.id;
  }
  return null;
}

function getPeriodEndingBalance(plan: Plan, period: Period, startingBalance: number) {
  const rows = buildTimeline(plan, period.id, startingBalance);
  return rows.length ? rows[rows.length - 1].balance : startingBalance;
}

export function getStartingBalance(plan: Plan, periodId: number) {
  const overrideMap = new Map<number, number>();
  plan.periodOverrides.forEach((o) => {
    if (typeof o.startingBalance === "number") {
      overrideMap.set(o.periodId, o.startingBalance);
    }
  });

  if (!plan.setup.rollForwardBalance) {
    return plan.setup.startingBalance;
  }

  const ordered = [...plan.periods].sort((a, b) => a.id - b.id);
  if (!ordered.length) return plan.setup.startingBalance;

  let start = overrideMap.get(ordered[0].id) ?? plan.setup.startingBalance;

  for (let idx = 0; idx < ordered.length; idx += 1) {
    const current = ordered[idx];
    if (idx > 0) {
      const prev = ordered[idx - 1];
      const prevEnd = getPeriodEndingBalance(plan, prev, start);
      start = overrideMap.get(current.id) ?? prevEnd;
    }

    if (current.id === periodId) return start;
  }

  return start;
}

function applyOverrides(ruleId: string, period: Period, overrides: CashflowOverride[]) {
  return overrides.filter((o) => o.ruleId === ruleId && o.date >= period.start && o.date <= period.end);
}

function applyEventOverrides(
  events: CashflowEvent[],
  overrides: EventOverride[],
  period: Period
) {
  if (!overrides.length) return events;
  const overrideMap = new Map(overrides.map((o) => [o.eventId, o]));
  const adjusted: CashflowEvent[] = [];

  for (const ev of events) {
    const override = overrideMap.get(ev.id);
    if (!override) {
      adjusted.push(ev);
      continue;
    }
    if (override.disabled) continue;
    const nextDate = override.date ?? ev.date;
    if (nextDate < period.start || nextDate > period.end) continue;
    adjusted.push({
      ...ev,
      date: nextDate,
      amount: typeof override.amount === "number" ? override.amount : ev.amount,
      id: ev.id,
    });
  }

  return adjusted;
}

function generateIncomeEvents(rule: IncomeRule, period: Period): CashflowEvent[] {
  if (!rule.enabled) return [];
  const events: CashflowEvent[] = [];
  const start = parseISO(period.start).getTime();
  const end = parseISO(period.end).getTime();

  const stepDays = rule.cadence === "weekly" ? 7 : rule.cadence === "biweekly" ? 14 : 0;
  if (rule.cadence === "monthly") {
    const seed = parseISO(rule.seedDate);
    const months = eachMonthBetween(period.start, period.end);
    for (const { year, month } of months) {
      const day = clampDay(year, month - 1, seed.getDate());
      const d = new Date(year, month - 1, day);
      const t = d.getTime();
      if (t < start || t > end) continue;
      events.push({
        id: `${rule.id}-${iso(d)}`,
        date: iso(d),
        label: rule.label,
        amount: rule.amount,
        type: "income",
        category: "income",
        sourceId: rule.id,
      });
    }
    return events;
  }

  const cur = parseISO(rule.seedDate);
  while (cur.getTime() < start) {
    cur.setDate(cur.getDate() + stepDays);
  }
  while (cur.getTime() <= end) {
    events.push({
      id: `${rule.id}-${iso(cur)}`,
      date: iso(cur),
      label: rule.label,
      amount: rule.amount,
      type: "income",
      category: "income",
      sourceId: rule.id,
    });
    cur.setDate(cur.getDate() + stepDays);
  }
  return events;
}

function generateOutflowEvents(rule: OutflowRule, period: Period): CashflowEvent[] {
  if (!rule.enabled) return [];
  const events: CashflowEvent[] = [];
  const start = parseISO(period.start).getTime();
  const end = parseISO(period.end).getTime();

  const stepDays = rule.cadence === "weekly" ? 7 : rule.cadence === "biweekly" ? 14 : 0;
  if (rule.cadence === "monthly") {
    const seed = parseISO(rule.seedDate);
    const months = eachMonthBetween(period.start, period.end);
    for (const { year, month } of months) {
      const day = clampDay(year, month - 1, seed.getDate());
      const d = new Date(year, month - 1, day);
      const t = d.getTime();
      if (t < start || t > end) continue;
      events.push({
        id: `${rule.id}-${iso(d)}`,
        date: iso(d),
        label: rule.label,
        amount: rule.amount,
        type: "outflow",
        category: rule.category,
        sourceId: rule.id,
      });
    }
    return events;
  }

  const cur = parseISO(rule.seedDate);
  while (cur.getTime() < start) {
    cur.setDate(cur.getDate() + stepDays);
  }
  while (cur.getTime() <= end) {
    events.push({
      id: `${rule.id}-${iso(cur)}`,
      date: iso(cur),
      label: rule.label,
      amount: rule.amount,
      type: "outflow",
      category: rule.category,
      sourceId: rule.id,
    });
    cur.setDate(cur.getDate() + stepDays);
  }
  return events;
}
function generateBills(
  bills: BillTemplate[],
  period: Period,
  disabledBills: Set<string>
): CashflowEvent[] {
  const events: CashflowEvent[] = [];
  const months = eachMonthBetween(period.start, period.end);
  for (const bill of bills) {
    if (!bill.enabled || disabledBills.has(bill.id)) continue;
    for (const { year, month } of months) {
      const day = clampDay(year, month - 1, bill.dueDay);
      const d = new Date(year, month - 1, day);
      const date = iso(d);
      if (date < period.start || date > period.end) continue;
      events.push({
        id: `${bill.id}-${date}`,
        date,
        label: bill.label,
        amount: bill.amount,
        type: "outflow",
        category: bill.category,
        sourceId: bill.id,
      });
    }
  }
  return events;
}

function getDisabledBills(plan: Plan, periodId: number) {
  const override = plan.periodOverrides.find((o) => o.periodId === periodId);
  return new Set(override?.disabledBills ?? []);
}

export function generateEvents(plan: Plan, periodId: number): CashflowEvent[] {

  const period = getPeriod(plan, periodId);
  const overrides = plan.overrides.filter((o) => o.date >= period.start && o.date <= period.end);

  // Build period rule overrides lookup: ruleId → override
  const periodRuleOverrideMap = new Map<string, PeriodRuleOverride>();
  for (const pro of plan.periodRuleOverrides ?? []) {
    if (pro.periodId === periodId) {
      periodRuleOverrideMap.set(pro.ruleId, pro);
    }
  }

  const incomeEvents: CashflowEvent[] = [];
  for (const rule of plan.incomeRules) {
    // Apply period rule override if present
    const pro = periodRuleOverrideMap.get(rule.id);
    const effectiveRule: IncomeRule = pro
      ? {
          ...rule,
          enabled: pro.enabled ?? rule.enabled,
          amount: pro.amount ?? rule.amount,
          cadence: pro.cadence ?? rule.cadence,
          seedDate: pro.seedDate ?? rule.seedDate,
        }
      : rule;

    const ruleOverrides = applyOverrides(rule.id, period, plan.overrides);
    if (ruleOverrides.length) {
      incomeEvents.push(
        ...ruleOverrides.map((o) => ({
          id: o.id,
          date: o.date,
          label: o.label,
          amount: o.amount,
          type: o.type,
          category: o.category,
          sourceId: o.ruleId,
        }))
      );
      continue;
    }
    incomeEvents.push(...generateIncomeEvents(effectiveRule, period));
  }

  const outflowEvents: CashflowEvent[] = [];
  for (const rule of plan.outflowRules) {
    // Apply period rule override if present
    const pro = periodRuleOverrideMap.get(rule.id);
    const effectiveRule: OutflowRule = pro
      ? {
          ...rule,
          enabled: pro.enabled ?? rule.enabled,
          amount: pro.amount ?? rule.amount,
          cadence: pro.cadence ?? rule.cadence,
          seedDate: pro.seedDate ?? rule.seedDate,
        }
      : rule;

    const ruleOverrides = applyOverrides(rule.id, period, plan.overrides);
    if (ruleOverrides.length) {
      outflowEvents.push(
        ...ruleOverrides.map((o) => ({
          id: o.id,
          date: o.date,
          label: o.label,
          amount: o.amount,
          type: o.type,
          category: o.category,
          sourceId: o.ruleId,
        }))
      );
      continue;
    }
    outflowEvents.push(...generateOutflowEvents(effectiveRule, period));
  }

  const disabledBills = getDisabledBills(plan, periodId);
  const billEvents = generateBills(plan.bills, period, disabledBills);

  const manualOverrides = overrides.filter((o) => !o.ruleId);
  const manualEvents: CashflowEvent[] = manualOverrides.map((o) => ({
    id: o.id,
    date: o.date,
    label: o.label,
    amount: o.amount,
    type: o.type,
    category: o.category,
    sourceId: o.ruleId,
  }));

  const merged = applyEventOverrides(
    [...incomeEvents, ...outflowEvents, ...billEvents, ...manualEvents],
    plan.eventOverrides ?? [],
    period
  );

  const sorted = merged.sort((a, b) => {
    if (a.date === b.date) return a.id.localeCompare(b.id);
    return a.date.localeCompare(b.date);
  });
  return sorted;
}

export function buildTimeline(plan: Plan, periodId: number, startingBalance: number): TimelineRow[] {

  const period = getPeriod(plan, periodId);
  const days = eachDayInclusive(period.start, period.end);
  const events = generateEvents(plan, periodId);

  const byDate = new Map<string, CashflowEvent[]>();
  for (const ev of events) {
    if (!byDate.has(ev.date)) byDate.set(ev.date, []);
    byDate.get(ev.date)!.push(ev);
  }

  let bal = startingBalance;

  const rows = days.map((date) => {
    const todays = byDate.get(date) ?? [];
    const income = money(
      todays.reduce((sum, e) => sum + (e.type === "income" ? e.amount : 0), 0)
    );
    const outflow = money(
      todays.reduce((sum, e) => sum + (e.type === "outflow" ? e.amount : 0), 0)
    );

    const label = todays.length
      ? todays.length === 1
        ? todays[0].label
        : todays.map((e) => e.label).join(" + ")
      : "";

    const net = money(income - outflow);
    bal = money(bal + net);

    return {
      date,
      label,
      income,
      outflow,
      net,
      balance: bal,
      warning: plan.setup.expectedMinBalance > 0 && bal < plan.setup.expectedMinBalance,
    };
  });
  return rows;
}

/**
 * Hybrid timeline: uses actual plan.transactions for dates ≤ asOfDate
 * (what really happened) and planned events for dates > asOfDate (forecast).
 * This means any transaction a user enters today immediately affects the
 * projected balance for all future days.
 */
export function buildHybridTimeline(
  plan: Plan,
  periodId: number,
  startingBalance: number
): TimelineRow[] {
  const period = getPeriod(plan, periodId);
  const asOfDate = plan.setup.asOfDate;
  const days = eachDayInclusive(period.start, period.end);
  const expectedMin = plan.setup.expectedMinBalance;

  // Planned future events indexed by date
  const plannedEvents = generateEvents(plan, periodId);
  const plannedByDate = new Map<string, CashflowEvent[]>();
  for (const ev of plannedEvents) {
    if (!plannedByDate.has(ev.date)) plannedByDate.set(ev.date, []);
    plannedByDate.get(ev.date)!.push(ev);
  }

  // Actual transactions within this period, indexed by date
  const actualTxns = plan.transactions.filter(
    (t) => t.date >= period.start && t.date <= period.end
  );
  const actualByDate = new Map<string, typeof actualTxns[number][]>();
  for (const t of actualTxns) {
    if (!actualByDate.has(t.date)) actualByDate.set(t.date, []);
    actualByDate.get(t.date)!.push(t);
  }

  // For dates that have BOTH actuals and planned events, actuals win.
  // For future dates with no actuals, fall back to planned events.
  // The running balance carries through seamlessly.
  let bal = startingBalance;
  return days.map((date) => {
    const isPastOrToday = date <= asOfDate;
    const hasActuals = actualByDate.has(date);

    if (isPastOrToday || hasActuals) {
      // Past / today — use real transactions
      const todays = actualByDate.get(date) ?? [];
      const income = money(todays.reduce((s, t) => s + (t.type === "income" ? t.amount : 0), 0));
      const outflow = money(todays.reduce((s, t) => s + (t.type === "outflow" ? t.amount : 0), 0));
      const label = todays.length
        ? todays.length === 1
          ? (todays[0].label || "Transaction")
          : todays.map((t) => t.label || "Transaction").join(" + ")
        : "";
      const net = money(income - outflow);
      bal = money(bal + net);
      return { date, label, income, outflow, net, balance: bal, warning: expectedMin > 0 && bal < expectedMin };
    } else {
      // Future — use planned/budgeted events as forecast
      const todays = plannedByDate.get(date) ?? [];
      const income = money(todays.reduce((s, e) => s + (e.type === "income" ? e.amount : 0), 0));
      const outflow = money(todays.reduce((s, e) => s + (e.type === "outflow" ? e.amount : 0), 0));
      const label = todays.length
        ? todays.length === 1
          ? todays[0].label
          : todays.map((e) => e.label).join(" + ")
        : "";
      const net = money(income - outflow);
      bal = money(bal + net);
      return { date, label, income, outflow, net, balance: bal, warning: expectedMin > 0 && bal < expectedMin };
    }
  });
}

/**
 * Actuals-only timeline: uses only plan.transactions for dates within the
 * period that are on or before asOfDate. Future dates are excluded — the line
 * naturally stops at today. Used as the "Actuals (Recorded)" line alongside
 * the budget forecast on the cashflow chart.
 */
export function buildActualsTimeline(
  plan: Plan,
  periodId: number,
  startingBalance: number
): TimelineRow[] {
  const period = getPeriod(plan, periodId);
  const asOfDate = plan.setup.asOfDate;
  const expectedMin = plan.setup.expectedMinBalance;

  // Only days from period start up to and including today
  const allDays = eachDayInclusive(period.start, period.end);
  const days = allDays.filter((d) => d <= asOfDate);
  if (!days.length) return [];

  const actualTxns = plan.transactions.filter(
    (t) => t.date >= period.start && t.date <= asOfDate
  );
  const byDate = new Map<string, typeof actualTxns[number][]>();
  for (const t of actualTxns) {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date)!.push(t);
  }

  let bal = startingBalance;
  return days.map((date) => {
    const todays = byDate.get(date) ?? [];
    const income = money(todays.reduce((s, t) => s + (t.type === "income" ? t.amount : 0), 0));
    const outflow = money(todays.reduce((s, t) => s + (t.type === "outflow" ? t.amount : 0), 0));
    const label = todays.length
      ? todays.length === 1
        ? todays[0].label || "Transaction"
        : todays.map((t) => t.label || "Transaction").join(" + ")
      : "";
    const net = money(income - outflow);
    bal = money(bal + net);
    return { date, label, income, outflow, net, balance: bal, warning: expectedMin > 0 && bal < expectedMin };
  });
}

export function minPoint(rows: TimelineRow[]) {
  if (!rows.length) return null;
  let min = rows[0];
  for (const r of rows) if (r.balance < min.balance) min = r;
  return min;
}

export function getWindow(plan: Plan) {
  const start = parseISO(plan.setup.asOfDate);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + Math.max(plan.setup.windowDays, 0));
  return { startISO: iso(start), endISO: iso(end) };
}

export function getUpcomingEvents(
  plan: Plan,
  periodId: number,
  type: "income" | "outflow"
) {
  const { startISO, endISO } = getWindow(plan);
  return generateEvents(plan, periodId).filter(
    (e) => e.type === type && e.date >= startISO && e.date <= endISO
  );
}

export function getDashboardSummary(plan: Plan, periodId: number, startingBalance: number) {
  const events = generateEvents(plan, periodId);
  const income = events.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const outflows = events.filter((e) => e.type === "outflow").reduce((s, e) => s + e.amount, 0);
  const rows = buildTimeline(plan, periodId, startingBalance);
  const min = minPoint(rows);
  return {
    income,
    outflows,
    net: income - outflows,
    lowest: min?.balance ?? null,
    lowestDate: min?.date ?? null,
  };
}

export function getVarianceByCategory(plan: Plan, periodId: number): VarianceByCategory {
  const period = getPeriod(plan, periodId);
  const budgeted = generateEvents(plan, periodId);
  const actual = plan.transactions.filter((t) => t.date >= period.start && t.date <= period.end);

  const categories: Set<CashflowCategory> = new Set();
  budgeted.forEach((e) => categories.add(e.category));
  actual.forEach((t) => categories.add(t.category));

  const result: VarianceByCategory = {};

  categories.forEach((cat) => {
    const budgetedAmount = budgeted
      .filter((e) => e.category === cat)
      .reduce((sum, e) => {
        // Transfers don't count toward outflow budgets, only actual outflows
        if (e.type === "transfer") return sum;
        return sum + (e.type === "outflow" ? e.amount : -e.amount);
      }, 0);

    const actualAmount = actual
      .filter((t) => t.category === cat)
      .reduce((sum, t) => {
        // Transfers are recorded separately, not in variance vs outflows
        if (t.type === "transfer") return sum;
        return sum + (t.type === "outflow" ? t.amount : -t.amount);
      }, 0);

    const variance = actualAmount - budgetedAmount;
    const variancePercent = budgetedAmount !== 0 ? (variance / Math.abs(budgetedAmount)) * 100 : 0;

    result[cat] = {
      category: cat,
      budgeted: Math.abs(budgetedAmount),
      actual: Math.abs(actualAmount),
      variance: variance,
      variancePercent: variancePercent,
      status: variance < -5 ? "under" : variance > 5 ? "over" : "neutral",
    };
  });

  return result;
}

export function getTotalVariance(plan: Plan, periodId: number) {
  const variance = getVarianceByCategory(plan, periodId);
  let totalBudgeted = 0;
  let totalActual = 0;

  Object.values(variance).forEach((v) => {
    if (v) {
      totalBudgeted += v.budgeted;
      totalActual += v.actual;
    }
  });

  return {
    budgeted: totalBudgeted,
    actual: totalActual,
    variance: totalActual - totalBudgeted,
    variancePercent: totalBudgeted !== 0 ? ((totalActual - totalBudgeted) / totalBudgeted) * 100 : 0,
  };
}

export function getSavingsTransferReconciliation(plan: Plan, periodId: number) {
  const period = getPeriod(plan, periodId);

  // Get budgeted savings transfers
  const budgetedSavings = generateEvents(plan, periodId)
    .filter((e) => e.category === "savings")
    .reduce((sum, e) => sum + e.amount, 0);

  // Get actual savings transfers
  const actualSavings = plan.transactions
    .filter((t) => t.date >= period.start && t.date <= period.end && t.type === "transfer" && t.category === "savings")
    .reduce((sum, t) => sum + t.amount, 0);

  const variance = actualSavings - budgetedSavings;
  const variancePercent = budgetedSavings !== 0 ? (variance / budgetedSavings) * 100 : 0;

  return {
    budgeted: budgetedSavings,
    actual: actualSavings,
    variance: variance,
    variancePercent: variancePercent,
    status: variance < -5 ? "under" : variance > 5 ? "over" : "neutral",
  };
}
