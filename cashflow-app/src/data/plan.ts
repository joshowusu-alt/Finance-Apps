export type CashflowCategory =
  | "income"
  | "bill"
  | "giving"
  | "savings"
  | "allowance"
  | "buffer"
  | "other";

export type CashflowType = "income" | "outflow" | "transfer";

export type CashflowEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  amount: number;
  type: CashflowType;
  category: CashflowCategory;
  sourceId?: string;
};

export type Period = {
  id: number;
  label: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
};

export type Recurrence = "weekly" | "biweekly" | "monthly";

export type IncomeRule = {
  id: string;
  label: string;
  amount: number;
  cadence: Recurrence;
  seedDate: string; // YYYY-MM-DD
  enabled: boolean;
};

export type OutflowRule = {
  id: string;
  label: string;
  amount: number;
  cadence: Recurrence;
  seedDate: string; // YYYY-MM-DD
  category: CashflowCategory;
  enabled: boolean;
};

export type PeriodRuleOverride = {
  periodId: number;
  ruleId: string;
  type: "income" | "outflow";
  enabled?: boolean;
  amount?: number;
  cadence?: Recurrence;
  seedDate?: string;
};

export type BillTemplate = {
  id: string;
  label: string;
  amount: number;
  dueDay: number; // day of month
  category: CashflowCategory;
  enabled: boolean;
};

export type PeriodOverride = {
  periodId: number;
  disabledBills?: string[];
  startingBalance?: number;
};

export type EventOverride = {
  id: string;
  eventId: string;
  date?: string;
  amount?: number;
  disabled?: boolean;
};

export type CashflowOverride = {
  id: string;
  ruleId?: string;
  date: string;
  label: string;
  amount: number;
  type: CashflowType;
  category: CashflowCategory;
};

export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  amount: number;
  type: CashflowType;
  category: CashflowCategory;
  notes?: string;
  linkedRuleId?: string; // for transfers, link to savings/outflow rule
  linkedBillId?: string; // optional explicit bill match
  goalId?: string;       // optional link to a SavingsGoal
};

export type PlanSetup = {
  selectedPeriodId: number;
  asOfDate: string; // YYYY-MM-DD
  autoUpdateAsOfDate?: boolean; // Auto-update asOfDate to today on load
  windowDays: number;
  startingBalance: number;
  rollForwardBalance: boolean;
  expectedMinBalance: number;
  variableCap: number;
};

export type SavingsGoal = {
  id: string;
  name: string;           // "Holiday Fund", "Emergency Fund"
  targetAmount: number;   // Target amount to save
  currentAmount: number;  // Manual baseline (pre-transaction-linking balance)
  createdAt: string;      // ISO date when goal was created
  targetDate?: string;    // Optional deadline (ISO date)
  color?: string;         // For visual distinction (hex color)
  icon?: string;          // Emoji icon
  status?: "active" | "completed" | "paused"; // Goal status
};

// ---------------------------------------------------------------------------
// Net Worth — accounts + historical snapshots
// ---------------------------------------------------------------------------
export type NetWorthAccountType =
  | "savings"         // savings/current accounts, cash
  | "investment"      // stocks, ISA, pension, crypto
  | "property"        // real estate, land
  | "other-asset"     // car, collectibles, valuables
  | "credit-card"     // credit card balance (liability)
  | "loan"            // personal loan, student loan
  | "mortgage"        // mortgage outstanding
  | "other-liability";// other debts

export type NetWorthAccount = {
  id: string;
  name: string;          // "Monzo Savings", "Vanguard ISA"
  type: NetWorthAccountType;
  institution?: string;  // "Monzo", "Vanguard"
  balance: number;       // manual balance (used when not auto-linked, or as snapshot baseline)
  notes?: string;
  icon?: string;         // emoji
  order?: number;        // display ordering
  // ── Auto-populate from cashflow transactions ────────────────────────────
  linkedRuleId?: string; // OutflowRule.id — accumulate matching transactions automatically
  linkedBillId?: string; // BillTemplate.id — accumulate matching bill transactions
  baseBalance?: number;  // opening balance for auto-calc (defaults to 0)
  baseDate?: string;     // YYYY-MM-DD — only count transactions on/after this date
};

export type NetWorthSnapshot = {
  id: string;
  date: string;          // YYYY-MM-DD — when snapshot was taken
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;      // assets - liabilities
  accountBalances: Record<string, number>; // accountId → balance at snapshot time
};

export type Plan = {
  version?: number;
  setup: PlanSetup;
  periods: Period[];
  incomeRules: IncomeRule[];
  outflowRules: OutflowRule[];
  periodRuleOverrides: PeriodRuleOverride[];
  bills: BillTemplate[];
  periodOverrides: PeriodOverride[];
  eventOverrides: EventOverride[];
  overrides: CashflowOverride[];
  transactions: Transaction[];
  savingsGoals?: SavingsGoal[];
  netWorthAccounts?: NetWorthAccount[];
  netWorthSnapshots?: NetWorthSnapshot[];
};

export const PLAN_VERSION = 2;

// ---------------------------------------------------------------------------
// Period cadence — how long each budget period lasts
// ---------------------------------------------------------------------------
export type PeriodCadence = "monthly" | "biweekly" | "weekly";

/**
 * Generate budget periods starting from a given date.
 * - "monthly"  → each period runs from `dayOfMonth` to the day before next month's start
 * - "biweekly" → 14-day periods
 * - "weekly"   → 7-day periods
 */
export function generatePeriods(
  startDate: string,
  cadence: PeriodCadence = "monthly",
  count = 12,
): Period[] {
  const periods: Period[] = [];
  const start = new Date(startDate + "T00:00:00");

  for (let i = 0; i < count; i++) {
    let periodStart: Date;
    let periodEnd: Date;

    if (cadence === "monthly") {
      // Advance by i months from the seed start date
      periodStart = new Date(start);
      periodStart.setMonth(periodStart.getMonth() + i);
      // End = one day before next period starts
      periodEnd = new Date(start);
      periodEnd.setMonth(periodEnd.getMonth() + i + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else {
      const days = cadence === "biweekly" ? 14 : 7;
      periodStart = new Date(start);
      periodStart.setDate(periodStart.getDate() + i * days);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + days - 1);
    }

    const s = fmtDate(periodStart);
    const e = fmtDate(periodEnd);
    periods.push({
      id: i + 1,
      label: `P${i + 1}: ${fmtLabel(periodStart)}-${fmtLabel(periodEnd)}`,
      start: s,
      end: e,
    });
  }

  return periods;
}

/** YYYY-MM-DD */
function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** "22 Dec 2025" style label */
export function fmtLabel(d: Date): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Smart default: find a sensible period start near today.
 * Uses the 1st of the current month so the user's first period
 * starts cleanly. Returns YYYY-MM-DD.
 */
export function defaultPeriodStart(): string {
  const now = new Date();
  return fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

// ---------------------------------------------------------------------------
// Default periods — dynamically generated from the 1st of the current month
// ---------------------------------------------------------------------------
export const DEFAULT_PERIODS: Period[] = generatePeriods(defaultPeriodStart(), "monthly", 12);

// ---------------------------------------------------------------------------
// Sample plan — generic data that teaches bills vs outflows, categories, etc.
// ---------------------------------------------------------------------------
export const SAMPLE_PLAN: Plan = {
  version: PLAN_VERSION,
  setup: {
    selectedPeriodId: 1,
    asOfDate: "2026-01-15",
    windowDays: 30,
    startingBalance: 2500,
    rollForwardBalance: true,
    expectedMinBalance: 500,
    variableCap: 400,
  },
  periods: DEFAULT_PERIODS,

  // --- Income: salary (monthly) + freelance side gig (monthly) ---
  incomeRules: [
    { id: "salary", label: "Salary", amount: 2800, cadence: "monthly", seedDate: "2026-01-01", enabled: true },
    { id: "freelance", label: "Freelance work", amount: 450, cadence: "monthly", seedDate: "2026-01-05", enabled: true },
  ],

  // --- Outflows: groceries (weekly), fuel (biweekly), pocket money (monthly), savings (monthly) ---
  outflowRules: [
    { id: "groceries", label: "Groceries", amount: 60, cadence: "weekly", seedDate: "2025-12-22", category: "allowance", enabled: true },
    { id: "fuel", label: "Fuel", amount: 45, cadence: "biweekly", seedDate: "2025-12-22", category: "other", enabled: true },
    { id: "pocket-money", label: "Pocket money", amount: 100, cadence: "monthly", seedDate: "2026-01-01", category: "allowance", enabled: true },
    { id: "savings", label: "Savings transfer", amount: 250, cadence: "monthly", seedDate: "2025-12-29", category: "savings", enabled: true },
  ],

  periodRuleOverrides: [],

  // --- Bills: fixed monthly obligations on specific due days ---
  bills: [
    { id: "rent", label: "Rent", amount: 950, dueDay: 1, category: "bill", enabled: true },
    { id: "council-tax", label: "Council Tax", amount: 145, dueDay: 5, category: "bill", enabled: true },
    { id: "electricity-gas", label: "Electricity & Gas", amount: 85, dueDay: 12, category: "bill", enabled: true },
    { id: "internet", label: "Internet", amount: 35, dueDay: 15, category: "bill", enabled: true },
    { id: "phone", label: "Phone", amount: 25, dueDay: 18, category: "bill", enabled: true },
    { id: "car-insurance", label: "Car Insurance", amount: 65, dueDay: 20, category: "bill", enabled: true },
    { id: "streaming", label: "Streaming (Netflix)", amount: 12.99, dueDay: 22, category: "bill", enabled: true },
    { id: "gym", label: "Gym membership", amount: 29.99, dueDay: 25, category: "bill", enabled: true },
  ],

  periodOverrides: [],
  eventOverrides: [],
  overrides: [],

  // --- Transactions: realistic mix across the first period ---
  transactions: [
    // Income
    { id: "txn-1", date: "2026-01-01", label: "Monthly salary", amount: 2800, type: "income", category: "income", notes: "Main employment" },
    { id: "txn-2", date: "2026-01-05", label: "Freelance - Logo design", amount: 450, type: "income", category: "income", notes: "Design client" },

    // Bill payments
    { id: "txn-3", date: "2025-12-22", label: "Netflix subscription", amount: 12.99, type: "outflow", category: "bill", notes: "Streaming (Netflix)", linkedBillId: "streaming" },
    { id: "txn-4", date: "2025-12-25", label: "Gym Direct Debit", amount: 29.99, type: "outflow", category: "bill", notes: "Gym membership", linkedBillId: "gym" },
    { id: "txn-5", date: "2026-01-01", label: "Rent payment", amount: 950, type: "outflow", category: "bill", notes: "Monthly rent", linkedBillId: "rent" },
    { id: "txn-6", date: "2026-01-05", label: "Council Tax", amount: 145, type: "outflow", category: "bill", notes: "Council Tax", linkedBillId: "council-tax" },
    { id: "txn-7", date: "2026-01-12", label: "Electric & Gas", amount: 85, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedBillId: "electricity-gas" },
    { id: "txn-8", date: "2026-01-15", label: "Broadband payment", amount: 35, type: "outflow", category: "bill", notes: "Internet", linkedBillId: "internet" },

    // Groceries (weekly outflow — linked to rule)
    { id: "txn-9", date: "2025-12-22", label: "Tesco weekly shop", amount: 58.40, type: "outflow", category: "allowance", notes: "Weekly groceries", linkedRuleId: "groceries" },
    { id: "txn-10", date: "2025-12-29", label: "Sainsbury's weekly shop", amount: 63.20, type: "outflow", category: "allowance", notes: "Weekly groceries", linkedRuleId: "groceries" },
    { id: "txn-11", date: "2026-01-05", label: "Tesco weekly shop", amount: 55.80, type: "outflow", category: "allowance", notes: "Weekly groceries", linkedRuleId: "groceries" },
    { id: "txn-12", date: "2026-01-12", label: "Aldi weekly shop", amount: 61.50, type: "outflow", category: "allowance", notes: "Weekly groceries", linkedRuleId: "groceries" },

    // Fuel (biweekly outflow — linked to rule)
    { id: "txn-13", date: "2025-12-22", label: "Fuel - Shell", amount: 42.30, type: "outflow", category: "other", notes: "Car fuel", linkedRuleId: "fuel" },
    { id: "txn-14", date: "2026-01-05", label: "Fuel - BP", amount: 47.60, type: "outflow", category: "other", notes: "Car fuel", linkedRuleId: "fuel" },

    // Pocket money (monthly outflow — linked to rule)
    { id: "txn-15", date: "2026-01-01", label: "Pocket money", amount: 100, type: "outflow", category: "allowance", notes: "Monthly allowance", linkedRuleId: "pocket-money" },

    // Savings transfer (linked to rule + goal)
    { id: "txn-16", date: "2025-12-29", label: "Savings transfer", amount: 250, type: "transfer", category: "savings", notes: "Monthly savings", linkedRuleId: "savings", goalId: "goal-emergency" },

    // Ad-hoc spending (unlinked — shows everyday life)
    { id: "txn-17", date: "2025-12-23", label: "Coffee shop", amount: 4.50, type: "outflow", category: "other", notes: "Morning coffee" },
    { id: "txn-18", date: "2025-12-24", label: "Uber to town", amount: 8.70, type: "outflow", category: "other", notes: "Transport" },
    { id: "txn-19", date: "2025-12-26", label: "Takeaway pizza", amount: 18.99, type: "outflow", category: "allowance", notes: "Dinner" },
    { id: "txn-20", date: "2025-12-27", label: "Amazon - Headphones", amount: 29.99, type: "outflow", category: "other", notes: "Electronics" },
    { id: "txn-21", date: "2025-12-28", label: "Cinema tickets", amount: 24.00, type: "outflow", category: "allowance", notes: "Entertainment" },
    { id: "txn-22", date: "2025-12-29", label: "Haircut", amount: 15.00, type: "outflow", category: "other", notes: "Personal care" },
    { id: "txn-23", date: "2025-12-30", label: "Pharmacy", amount: 8.45, type: "outflow", category: "other", notes: "Health" },
    { id: "txn-24", date: "2025-12-31", label: "New Year's dinner", amount: 45.00, type: "outflow", category: "allowance", notes: "Celebration" },
    { id: "txn-25", date: "2026-01-02", label: "Bus pass top-up", amount: 12.00, type: "outflow", category: "other", notes: "Transport" },
    { id: "txn-26", date: "2026-01-03", label: "Takeaway - Chinese", amount: 22.50, type: "outflow", category: "allowance", notes: "Dinner" },
    { id: "txn-27", date: "2026-01-03", label: "Parking fee", amount: 4.00, type: "outflow", category: "other", notes: "Transport" },
    { id: "txn-28", date: "2026-01-04", label: "Books - Waterstones", amount: 14.99, type: "outflow", category: "other", notes: "Shopping" },
    { id: "txn-29", date: "2026-01-06", label: "Gym protein shake", amount: 3.50, type: "outflow", category: "other", notes: "Health" },
    { id: "txn-30", date: "2026-01-07", label: "Lunch at work", amount: 7.80, type: "outflow", category: "allowance", notes: "Food" },
    { id: "txn-31", date: "2026-01-08", label: "Dry cleaning", amount: 12.50, type: "outflow", category: "other", notes: "Personal care" },
    { id: "txn-32", date: "2026-01-08", label: "Phone screen protector", amount: 9.99, type: "outflow", category: "other", notes: "Accessories" },
    { id: "txn-33", date: "2026-01-09", label: "Spotify subscription", amount: 10.99, type: "outflow", category: "other", notes: "Entertainment" },
    { id: "txn-34", date: "2026-01-10", label: "Uber to meeting", amount: 11.20, type: "outflow", category: "other", notes: "Transport" },
    { id: "txn-35", date: "2026-01-10", label: "Top-up shop", amount: 12.40, type: "outflow", category: "allowance", notes: "Extra groceries" },
    { id: "txn-36", date: "2026-01-11", label: "Sunday roast ingredients", amount: 16.30, type: "outflow", category: "allowance", notes: "Cooking" },
    { id: "txn-37", date: "2026-01-13", label: "Coffee and pastry", amount: 6.90, type: "outflow", category: "other", notes: "Snack" },
    { id: "txn-38", date: "2026-01-14", label: "Taxi home", amount: 15.40, type: "outflow", category: "other", notes: "Transport" },
    { id: "txn-39", date: "2026-01-14", label: "Eye test", amount: 25.00, type: "outflow", category: "other", notes: "Health" },
    { id: "txn-40", date: "2026-01-15", label: "Lunch with colleague", amount: 13.50, type: "outflow", category: "allowance", notes: "Food" },
  ],

  // --- Savings goals ---
  savingsGoals: [
    { id: "goal-emergency", name: "Emergency Fund", targetAmount: 3000, currentAmount: 1200, createdAt: "2025-12-01", icon: "🛡️", color: "#22c55e" },
    { id: "goal-holiday", name: "Holiday", targetAmount: 800, currentAmount: 300, createdAt: "2025-12-01", targetDate: "2026-08-01", icon: "✈️", color: "#3b82f6" },
  ],
};

const SAMPLE_PLAN_JSON = JSON.stringify(SAMPLE_PLAN);

export function createSamplePlan(): Plan {
  return JSON.parse(SAMPLE_PLAN_JSON) as Plan;
}

// ---------------------------------------------------------------------------
// Empty plan — fresh start for new users, independent of sample data
// ---------------------------------------------------------------------------
export const EMPTY_PLAN: Plan = {
  version: PLAN_VERSION,
  setup: {
    selectedPeriodId: 1,
    asOfDate: new Date().toISOString().split("T")[0],
    windowDays: 30,
    startingBalance: 0,
    rollForwardBalance: true,
    expectedMinBalance: 0,
    variableCap: 0,
  },
  periods: DEFAULT_PERIODS,
  incomeRules: [],
  outflowRules: [],
  periodRuleOverrides: [],
  bills: [],
  periodOverrides: [],
  eventOverrides: [],
  overrides: [],
  transactions: [],
  savingsGoals: [],
};

// Default entry point is now the empty plan
export const PLAN = EMPTY_PLAN;
