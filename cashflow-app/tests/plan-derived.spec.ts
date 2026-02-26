import { test, expect } from "@playwright/test";

const planKey = "cashflow_plan_v2";
const scenarioKey = "cashflow_scenarios_v1";
const currencyKey = "velanovo-currency";

const scenarioState = {
  activeId: "default",
  scenarios: [
    {
      id: "default",
      name: "Main plan",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
  ],
};

const basePlan = {
  version: 2,
  setup: {
    selectedPeriodId: 1,
    asOfDate: "2026-01-15",
    autoUpdateAsOfDate: false,
    windowDays: 30,
    startingBalance: 1000,
    rollForwardBalance: true,
    expectedMinBalance: 200,
    variableCap: 0,
  },
  periods: [
    { id: 1, label: "P1: 22 Dec 2025-25 Jan 2026", start: "2025-12-22", end: "2026-01-25" },
  ],
  incomeRules: [
    {
      id: "income-1",
      label: "Salary",
      amount: 2000,
      cadence: "monthly",
      seedDate: "2026-01-01",
      enabled: true,
    },
  ],
  outflowRules: [
    {
      id: "outflow-1",
      label: "Weekly Allowance",
      amount: 100,
      cadence: "weekly",
      seedDate: "2025-12-22",
      category: "allowance",
      enabled: true,
    },
  ],
  periodRuleOverrides: [],
  bills: [
    {
      id: "bill-1",
      label: "Rent",
      amount: 900,
      dueDay: 1,
      category: "bill",
      enabled: true,
    },
  ],
  periodOverrides: [],
  eventOverrides: [],
  overrides: [],
  transactions: [],
  savingsGoals: [],
};

async function seedStorage(page: import("@playwright/test").Page, plan: Record<string, unknown>) {
  await page.addInitScript(
    ({ plan, scenarioState, planKey, scenarioKey, currencyKey }: { plan: unknown; scenarioState: unknown; planKey: string; scenarioKey: string; currencyKey: string }) => {
      localStorage.setItem(currencyKey, "GBP");
      localStorage.setItem(scenarioKey, JSON.stringify(scenarioState));
      localStorage.setItem(planKey, JSON.stringify(plan));
    },
    { plan, scenarioState, planKey, scenarioKey, currencyKey }
  );
}

async function applyPlanUpdate(page: import("@playwright/test").Page, plan: Record<string, unknown>) {
  await page.evaluate(
    ({ plan, planKey }: { plan: unknown; planKey: string }) => {
      localStorage.setItem(planKey, JSON.stringify(plan));
      window.dispatchEvent(new Event("cashflow:plan-updated"));
    },
    { plan, planKey }
  );
}

async function expectPlanValues(page: any, income: string, bills: string, remaining: string) {
  const incomeCard = page.locator(".vn-card", { hasText: "Plan Income" }).first();
  const billsCard = page.locator(".vn-card", { hasText: "Committed Bills" }).first();

  await expect(incomeCard.locator("div.text-2xl")).toHaveText(income);
  await expect(billsCard.locator("div.text-2xl")).toHaveText(bills);

  const remainingRow = page.getByText("Remaining / Unallocated").locator("..");
  await expect(remainingRow.locator("span").nth(1)).toHaveText(remaining);
}

test("plan persists after hard reload", async ({ page }) => {
  await seedStorage(page, basePlan);
  await page.goto("http://localhost:3000/plan", { waitUntil: "networkidle" });

  await expectPlanValues(page, "\\u00a32,000.00", "\\u00a3900.00", "\\u00a3600.00");

  await page.reload({ waitUntil: "networkidle" });
  await expectPlanValues(page, "\\u00a32,000.00", "\\u00a3900.00", "\\u00a3600.00");

  await page.goto("http://localhost:3000/insights", { waitUntil: "networkidle" });
  const remainingCard = page.getByText("Remaining After Plan").locator("..");
  await expect(remainingCard.getByText("\\u00a3600.00")).toBeVisible();
});

test("derived metrics update after sequential changes", async ({ page }) => {
  await seedStorage(page, basePlan);
  await page.goto("http://localhost:3000/plan", { waitUntil: "networkidle" });

  await expectPlanValues(page, "\\u00a32,000.00", "\\u00a3900.00", "\\u00a3600.00");

  const planIncomeUpdate = {
    ...basePlan,
    incomeRules: [{ ...basePlan.incomeRules[0], amount: 2500 }],
  };
  await applyPlanUpdate(page, planIncomeUpdate);
  await expectPlanValues(page, "\\u00a32,500.00", "\\u00a3900.00", "\\u00a31,100.00");

  const planBillUpdate = {
    ...planIncomeUpdate,
    bills: [{ ...planIncomeUpdate.bills[0], amount: 1000 }],
  };
  await applyPlanUpdate(page, planBillUpdate);
  await expectPlanValues(page, "\\u00a32,500.00", "\\u00a31,000.00", "\\u00a31,000.00");

  const planOutflowUpdate = {
    ...planBillUpdate,
    outflowRules: [{ ...planBillUpdate.outflowRules[0], amount: 200 }],
  };
  await applyPlanUpdate(page, planOutflowUpdate);
  await expectPlanValues(page, "\\u00a32,500.00", "\\u00a31,000.00", "\\u00a3500.00");

  await page.goto("http://localhost:3000/insights", { waitUntil: "networkidle" });
  const remainingCard = page.getByText("Remaining After Plan").locator("..");
  await expect(remainingCard.getByText("\\u00a3500.00")).toBeVisible();
});
