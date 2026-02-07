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
  currentAmount: number;  // Amount saved so far
  createdAt: string;      // ISO date when goal was created
  targetDate?: string;    // Optional deadline (ISO date)
  color?: string;         // For visual distinction (hex color)
  icon?: string;          // Emoji icon
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
};

export const PLAN_VERSION = 2;

export const SAMPLE_PLAN: Plan = {
  version: PLAN_VERSION,
  setup: {
    selectedPeriodId: 1,
    asOfDate: "2026-01-15",
    windowDays: 30,
    startingBalance: 0,
    rollForwardBalance: true,
    expectedMinBalance: 900,
    variableCap: 420,
  },
  periods: [
    { id: 1, label: "P1: 22 Dec 2025-25 Jan 2026", start: "2025-12-22", end: "2026-01-25" },
    { id: 2, label: "P2: 26 Jan 2026-25 Feb 2026", start: "2026-01-26", end: "2026-02-25" },
    { id: 3, label: "P3: 26 Feb 2026-25 Mar 2026", start: "2026-02-26", end: "2026-03-25" },
    { id: 4, label: "P4: 26 Mar 2026-25 Apr 2026", start: "2026-03-26", end: "2026-04-25" },
    { id: 5, label: "P5: 26 Apr 2026-25 May 2026", start: "2026-04-26", end: "2026-05-25" },
    { id: 6, label: "P6: 26 May 2026-25 Jun 2026", start: "2026-05-26", end: "2026-06-25" },
    { id: 7, label: "P7: 26 Jun 2026-25 Jul 2026", start: "2026-06-26", end: "2026-07-25" },
    { id: 8, label: "P8: 26 Jul 2026-25 Aug 2026", start: "2026-07-26", end: "2026-08-25" },
    { id: 9, label: "P9: 26 Aug 2026-25 Sep 2026", start: "2026-08-26", end: "2026-09-25" },
    { id: 10, label: "P10: 26 Sep 2026-25 Oct 2026", start: "2026-09-26", end: "2026-10-25" },
    { id: 11, label: "P11: 26 Oct 2026-25 Nov 2026", start: "2026-10-26", end: "2026-11-25" },
    { id: 12, label: "P12: 26 Nov 2026-25 Dec 2026", start: "2026-11-26", end: "2026-12-25" },
  ],
  incomeRules: [
    { id: "fm", label: "FM income", amount: 3500, cadence: "monthly", seedDate: "2025-12-26", enabled: true },
    { id: "mcd", label: "McD income", amount: 400, cadence: "biweekly", seedDate: "2026-01-01", enabled: true },
    { id: "outlier", label: "Outlier income", amount: 100, cadence: "weekly", seedDate: "2026-01-07", enabled: true },
  ],
  outflowRules: [
    { id: "savings", label: "Savings transfer", amount: 1050, cadence: "monthly", seedDate: "2025-12-29", category: "savings", enabled: true },
    { id: "allowance", label: "Weekly allowance", amount: 140, cadence: "weekly", seedDate: "2025-12-29", category: "allowance", enabled: true },
  ],
  periodRuleOverrides: [],
  bills: [
    { id: "rent", label: "Rent", amount: 550.0, dueDay: 28, category: "bill", enabled: true },
    { id: "insurance", label: "Insurance", amount: 175.0, dueDay: 28, category: "bill", enabled: true },
    { id: "road-tax", label: "Road Tax", amount: 34.0, dueDay: 28, category: "bill", enabled: true },
    { id: "water-bill", label: "Water Bill", amount: 93.0, dueDay: 28, category: "bill", enabled: true },
    { id: "community-fibre-internet", label: "Community Fibre / Internet", amount: 37.0, dueDay: 26, category: "bill", enabled: true },
    { id: "electricity-gas", label: "Electricity & Gas", amount: 200.0, dueDay: 26, category: "bill", enabled: true },
    { id: "iphone-payments", label: "iPhone Payments", amount: 108.0, dueDay: 26, category: "bill", enabled: true },
    { id: "parents", label: "Parents", amount: 140.0, dueDay: 26, category: "giving", enabled: true },
    { id: "credit-card-payment", label: "Credit Card Payment", amount: 400.0, dueDay: 26, category: "bill", enabled: true },
    { id: "fuel", label: "Fuel", amount: 100.0, dueDay: 26, category: "bill", enabled: true },
    { id: "tithe", label: "Tithe", amount: 410.0, dueDay: 26, category: "giving", enabled: true },
    { id: "offerings", label: "Offerings", amount: 165.0, dueDay: 26, category: "giving", enabled: true },
    { id: "charity-perez-uni", label: "Charity - Perez Uni", amount: 50.0, dueDay: 26, category: "giving", enabled: true },
    { id: "charity-jpc-utilities", label: "Charity - JPC Utilities", amount: 100.0, dueDay: 26, category: "giving", enabled: true },
    { id: "laptop", label: "Laptop", amount: 43.0, dueDay: 29, category: "bill", enabled: true },
    { id: "one-off-giving-christmas", label: "One-Off Giving (Christmas)", amount: 500.0, dueDay: 26, category: "giving", enabled: true },
  ],
  periodOverrides: [],
  eventOverrides: [],
  overrides: [
    { id: "fm-early-2025-12-22", ruleId: "fm", date: "2025-12-22", label: "FM income (early)", amount: 3500, type: "income", category: "income" },
  ],
  transactions: [
    { id: "txn-1", date: "2025-12-15", label: "Apple cloud subscription", amount: 2.99, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-2", date: "2025-12-16", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-3", date: "2025-12-17", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-4", date: "2025-12-17", label: "Costco", amount: 45.6, type: "outflow", category: "allowance", notes: "Food", linkedRuleId: undefined },
    { id: "txn-5", date: "2025-12-18", label: "Tesco", amount: 4.99, type: "outflow", category: "allowance", notes: "Food", linkedRuleId: undefined },
    { id: "txn-6", date: "2025-12-19", label: "Costco", amount: 4, type: "outflow", category: "allowance", notes: "Food", linkedRuleId: undefined },
    { id: "txn-7", date: "2025-12-16", label: "Transportation - TfL", amount: 7.2, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-8", date: "2025-12-19", label: "Fuel", amount: 30.01, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-9", date: "2025-12-20", label: "Transportation - TfL", amount: 10.1, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-10", date: "2025-12-20", label: "Transportation - TfL", amount: 4.97, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-11", date: "2025-12-21", label: "Tyre puncture", amount: 10, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-12", date: "2025-12-22", label: "December Salary", amount: 3700, type: "income", category: "income", notes: "Income - FM", linkedRuleId: undefined },
    { id: "txn-13", date: "2025-12-22", label: "Cerelac", amount: 9.5, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-14", date: "2025-12-23", label: "Gas", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-15", date: "2025-12-23", label: "GRA transport", amount: 6.47, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-16", date: "2025-12-23", label: "FM Tithe", amount: 371, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-17", date: "2025-12-23", label: "Utility Sacrifices", amount: 100, type: "outflow", category: "giving", notes: "Charity - JPC Utilities", linkedRuleId: undefined },
    { id: "txn-18", date: "2025-12-23", label: "Thanksgiving Offering", amount: 80, type: "outflow", category: "giving", notes: "Offerings", linkedRuleId: undefined },
    { id: "txn-19", date: "2025-12-23", label: "Thanksgiving Offering", amount: 60, type: "outflow", category: "giving", notes: "Offerings", linkedRuleId: undefined },
    { id: "txn-20", date: "2025-12-23", label: "Mummy J and Mummy R", amount: 140, type: "outflow", category: "giving", notes: "Parents", linkedRuleId: undefined },
    { id: "txn-21", date: "2025-12-24", label: "Outlier on 24/12/2025", amount: 111.48, type: "income", category: "income", notes: "Income - Outlier", linkedRuleId: undefined },
    { id: "txn-22", date: "2025-12-24", label: "Outlier Tithe", amount: 12, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-23", date: "2025-12-23", label: "Wipes", amount: 11.25, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-24", date: "2025-12-22", label: "Monzo payment", amount: 295.20999999999998, type: "outflow", category: "bill", notes: "Credit Card Payment", linkedRuleId: undefined },
    { id: "txn-25", date: "2025-12-22", label: "Sacrifice for Dec", amount: 50, type: "outflow", category: "giving", notes: "Charity - Perez Uni", linkedRuleId: undefined },
    { id: "txn-26", date: "2025-12-22", label: "Lebara", amount: 9, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-27", date: "2025-12-22", label: "Body wash", amount: 16.5, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-28", date: "2025-12-24", label: "Gift to families", amount: 457.37, type: "outflow", category: "giving", notes: "One-Off Giving (Christmas)", linkedRuleId: undefined },
    { id: "txn-29", date: "2025-12-24", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-30", date: "2025-12-24", label: "Ingredients for cake", amount: 7.78, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-31", date: "2025-12-24", label: "Fuel for Renault Scenic", amount: 30.17, type: "outflow", category: "bill", notes: "Fuel", linkedRuleId: undefined },
    { id: "txn-32", date: "2025-12-26", label: "payment for wifey's phone", amount: 29, type: "outflow", category: "bill", notes: "iPhone Payments", linkedRuleId: undefined },
    { id: "txn-33", date: "2025-12-24", label: "Subription for Capcut", amount: 10.99, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-34", date: "2025-12-26", label: "Gas for house", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-35", date: "2025-12-27", label: "Hosting Samuel and Honey", amount: 31.98, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-36", date: "2025-12-28", label: "Boba for the house", amount: 16.3, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-37", date: "2025-12-29", label: "Capital one for Dec", amount: 111.62, type: "outflow", category: "bill", notes: "Credit Card Payment", linkedRuleId: undefined },
    { id: "txn-38", date: "2025-12-29", label: "Capital one for Dec", amount: 32.090000000000003, type: "outflow", category: "bill", notes: "Credit Card Payment", linkedRuleId: undefined },
    { id: "txn-39", date: "2025-12-29", label: "Water bill for December", amount: 92.77, type: "outflow", category: "bill", notes: "Water Bill", linkedRuleId: undefined },
    { id: "txn-40", date: "2025-12-29", label: "Community fibre/ internet for December", amount: 36.83, type: "outflow", category: "bill", notes: "Community Fibre / Internet", linkedRuleId: undefined },
    { id: "txn-41", date: "2025-12-29", label: "Laptop for December", amount: 43, type: "outflow", category: "bill", notes: "Laptop", linkedRuleId: undefined },
    { id: "txn-42", date: "2025-12-29", label: "Water and toothpaste", amount: 10.199999999999999, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-43", date: "2025-12-30", label: "Barclays Prtnr Fin", amount: 24.95, type: "outflow", category: "bill", notes: "iPhone Payments", linkedRuleId: undefined },
    { id: "txn-44", date: "2025-12-29", label: "Mayor for his Provisional Lisence", amount: 34, type: "outflow", category: "giving", notes: "Donations (Variable)", linkedRuleId: undefined },
    { id: "txn-45", date: "2025-12-29", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-46", date: "2025-12-29", label: "Gas", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-47", date: "2025-12-31", label: "Rent for December", amount: 550, type: "outflow", category: "bill", notes: "Rent", linkedRuleId: undefined },
    { id: "txn-48", date: "2025-12-28", label: "Fried rice", amount: 16.72, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-49", date: "2025-12-30", label: "Bolt to McD", amount: 11.02, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-50", date: "2025-12-31", label: "Stocks and Shares ISA", amount: 20, type: "transfer", category: "savings", notes: "Savings Transfer", linkedRuleId: "savings" },
    { id: "txn-51", date: "2025-12-31", label: "SkyMobile", amount: 55.9, type: "outflow", category: "bill", notes: "iPhone Payments", linkedRuleId: undefined },
    { id: "txn-52", date: "2025-12-31", label: "Car insurance", amount: 174.33, type: "outflow", category: "bill", notes: "Insurance", linkedRuleId: undefined },
    { id: "txn-53", date: "2025-12-31", label: "for period 23/12 - 30/12", amount: 125.02, type: "income", category: "income", notes: "Income - Outlier", linkedRuleId: undefined },
    { id: "txn-54", date: "2025-12-31", label: "Tithe on Outlier inflow", amount: 13, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-55", date: "2025-12-31", label: "Fuel to Georges Kablan for 31st Night", amount: 25, type: "outflow", category: "giving", notes: "Donations (Variable)", linkedRuleId: undefined },
    { id: "txn-56", date: "2026-01-01", label: "Interest on Monzo savings", amount: 0.28000000000000003, type: "income", category: "income", notes: "Income - Outlier", linkedRuleId: undefined },
    { id: "txn-57", date: "2025-12-31", label: "Fuel for Renault Scenic", amount: 20, type: "outflow", category: "bill", notes: "Fuel", linkedRuleId: undefined },
    { id: "txn-58", date: "2026-01-01", label: "Gas for house", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-59", date: "2025-12-31", label: "Gift to Deaconess Leticia", amount: 100, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-60", date: "2025-12-31", label: "Ikea stuff - basket etc", amount: 37.35, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-61", date: "2025-12-31", label: "Thornton Heath stuff for food", amount: 46, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-62", date: "2025-12-31", label: "Sainsbury's - food stuff", amount: 16.29, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-63", date: "2025-12-31", label: "Lebara", amount: 9, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-64", date: "2025-12-31", label: "KitKatt for the raod - Honey dropoff", amount: 4.95, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-65", date: "2026-01-01", label: "Tuna flakes - Clifton", amount: 3.58, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-66", date: "2026-01-01", label: "Family Bowling", amount: 19.899999999999999, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-67", date: "2026-01-02", label: "Income from McD", amount: 565.36, type: "income", category: "income", notes: "Income - McD", linkedRuleId: undefined },
    { id: "txn-68", date: "2026-01-02", label: "Tithe on McD", amount: 57, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-69", date: "2026-01-02", label: "Transfer to Money Box", amount: 500, type: "transfer", category: "savings", notes: "Savings Transfer", linkedRuleId: "savings" },
    { id: "txn-70", date: "2026-01-02", label: "Road tax for Dec", amount: 33.68, type: "outflow", category: "bill", notes: "Road Tax", linkedRuleId: undefined },
    { id: "txn-71", date: "2026-01-02", label: "Water from Sainsbury's", amount: 6, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-72", date: "2026-01-02", label: "Family Outting - Straford, TfL", amount: 1.5, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-73", date: "2026-01-02", label: "Family Outting - Straford, Ride on Kiddie - Josh", amount: 2, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-74", date: "2026-01-02", label: "Uber to the house", amount: 8.91, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-75", date: "2026-01-02", label: "Food for the outing", amount: 39.5, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-76", date: "2026-01-03", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-77", date: "2026-01-03", label: "TfL for family outing", amount: 6.65, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-78", date: "2026-01-03", label: "Inaugural Service Meat Pie -PCIC", amount: 45, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-79", date: "2026-01-04", label: "Gas", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-80", date: "2026-01-04", label: "Burnt offering for Jan", amount: 21.16, type: "outflow", category: "giving", notes: "Offerings", linkedRuleId: undefined },
    { id: "txn-81", date: "2026-01-04", label: "OpenAI - chatgpt payment", amount: 20, type: "outflow", category: "other", notes: "Others", linkedRuleId: undefined },
    { id: "txn-82", date: "2026-01-05", label: "Post office payment for Daddy", amount: 6.9, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-83", date: "2026-01-04", label: "Tesco - Gifts for Zonal Overseer", amount: 41.05, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-84", date: "2026-01-06", label: "Gifts on Tiktok live - Bishop JNO", amount: 2.69, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-85", date: "2026-01-03", label: "TfL for family outing", amount: 6.95, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-86", date: "2026-01-06", label: "Transfer to Money Box", amount: 50, type: "transfer", category: "savings", notes: "Savings Transfer", linkedRuleId: "savings" },
    { id: "txn-87", date: "2026-01-06", label: "Transfer to Money Box", amount: 20, type: "transfer", category: "savings", notes: "Savings Transfer", linkedRuleId: "savings" },
    { id: "txn-88", date: "2026-01-06", label: "Fuel for Renault Scenic", amount: 20, type: "outflow", category: "bill", notes: "Fuel", linkedRuleId: undefined },
    { id: "txn-89", date: "2026-01-06", label: "Fixing tyre for Renault Scenic", amount: 10, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-90", date: "2026-01-06", label: "Water for the house - Sainsbury's", amount: 6, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-91", date: "2026-01-07", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-92", date: "2026-01-07", label: "Gas for house", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-93", date: "2026-01-07", label: "Outlier income 07/01/2026", amount: 73.45, type: "income", category: "income", notes: "Income - Outlier", linkedRuleId: undefined },
    { id: "txn-94", date: "2026-01-07", label: "Tithe on Outlier inflow", amount: 8, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-95", date: "2026-01-07", label: "TfL to office on 06/01/2026", amount: 6.6, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-96", date: "2026-01-07", label: "Gift from Honey", amount: 100, type: "income", category: "income", notes: "Income - Gifts", linkedRuleId: undefined },
    { id: "txn-97", date: "2026-01-08", label: "Gift from Honey - Tithe", amount: 10, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-98", date: "2026-01-08", label: "Costco - House stuff", amount: 109.73, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-99", date: "2026-01-08", label: "Holland bazaar - house stuff", amount: 15.58, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-100", date: "2026-01-08", label: "Fish Market - house stuff", amount: 20.99, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-101", date: "2026-01-08", label: "S & S Halal Butchers L", amount: 26.5, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-102", date: "2026-01-08", label: "Sainsbury's - food stuff", amount: 7.24, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-103", date: "2026-01-09", label: "Subscriptions - Ch_Luxelens", amount: 15, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-104", date: "2026-01-10", label: "Subscriptions - Ch_Luxelens", amount: 11, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-105", date: "2026-01-10", label: "Gas for house", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-106", date: "2026-01-11", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-107", date: "2026-01-12", label: "Transfer to Money Box", amount: 20, type: "transfer", category: "savings", notes: "Savings Transfer", linkedRuleId: "savings" },
    { id: "txn-108", date: "2026-01-12", label: "Battery for Renault key", amount: 5, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-109", date: "2026-01-14", label: "Income from Outlier", amount: 145.59, type: "income", category: "income", notes: "Income - Outlier", linkedRuleId: undefined },
    { id: "txn-110", date: "2026-01-14", label: "Tithe on Outlier inflow", amount: 15, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-111", date: "2026-01-14", label: "Towing Renault Scenic to  Workshop", amount: 75, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-112", date: "2026-01-13", label: "Uber eats for the house - Fried rice", amount: 13.59, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-113", date: "2026-01-13", label: "Gas for house", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-114", date: "2026-01-13", label: "Transport to office - Hubby", amount: 2.2000000000000002, type: "outflow", category: "other", notes: "Uber - TfL", linkedRuleId: undefined },
    { id: "txn-115", date: "2026-01-14", label: "Deliveroo - indomie etc", amount: 8.68, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-116", date: "2026-01-14", label: "Transport to work - wifey", amount: 1.75, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-117", date: "2026-01-14", label: "Sainsbury's - food stuff", amount: 27.73, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-118", date: "2026-01-10", label: "Transport to work - wifey", amount: 11.81, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-119", date: "2026-01-10", label: "Transport to work - wifey", amount: 8.83, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-120", date: "2026-01-11", label: "Transport to church", amount: 6.33, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-121", date: "2026-01-11", label: "Food for house - Kenkey House", amount: 24.5, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-122", date: "2026-01-12", label: "Transport to work - wifey", amount: 9.7899999999999991, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-123", date: "2026-01-15", label: "Income from McD", amount: 498.31, type: "income", category: "income", notes: "Income - McD", linkedRuleId: undefined },
    { id: "txn-124", date: "2026-01-15", label: "Tithe on McD", amount: 50, type: "outflow", category: "giving", notes: "Tithe", linkedRuleId: undefined },
    { id: "txn-125", date: "2026-01-15", label: "Uber fare to viewing at Albatross", amount: 8.48, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-126", date: "2026-01-15", label: "Uber fare to viewing at Albatross", amount: 12.72, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-127", date: "2026-01-15", label: "Transfer to Money Box", amount: 250, type: "transfer", category: "savings", notes: "Savings Transfer", linkedRuleId: "savings" },
    { id: "txn-128", date: "2026-01-15", label: "Electricity", amount: 10, type: "outflow", category: "bill", notes: "Electricity & Gas", linkedRuleId: undefined },
    { id: "txn-129", date: "2026-01-15", label: "Uber to evening service", amount: 6.71, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
    { id: "txn-130", date: "2026-01-16", label: "Uber to Ch_luxelens appointment", amount: 18.32, type: "outflow", category: "allowance", notes: "House Keep", linkedRuleId: undefined },
  ],
};

export const EMPTY_PLAN: Plan = {
  version: PLAN_VERSION,
  setup: {
    ...SAMPLE_PLAN.setup,
    startingBalance: 0,
    expectedMinBalance: 0,
    variableCap: 0,
    asOfDate: new Date().toISOString().split("T")[0],
  },
  periods: SAMPLE_PLAN.periods, // Keep default periods so calendar works
  incomeRules: [],
  outflowRules: [],
  periodRuleOverrides: [],
  bills: [],
  periodOverrides: [],
  eventOverrides: [],
  overrides: [],
  transactions: [],
  savingsGoals: [], // Ensure savings goals are empty
};

// Default entry point is now the empty plan
export const PLAN = EMPTY_PLAN;
