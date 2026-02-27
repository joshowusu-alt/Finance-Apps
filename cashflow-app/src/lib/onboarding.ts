import type { Plan, BillTemplate, IncomeRule, PeriodCadence } from "@/data/plan";
import { PLAN, PLAN_VERSION, generatePeriods } from "@/data/plan";
import { DEFAULT_BILLS } from "@/data/onboardingData";
import { getStorageScope } from "@/lib/storage";
import { touchPreferencesUpdatedAt } from "@/lib/preferencesSync";

const ONBOARDING_KEY = "cashflow_onboarding_v1";
const WIZARD_KEY = "cashflow_wizard_v1";

export type OnboardingState = {
  dismissed: boolean;
  completed: Record<string, boolean>;
};

export type WizardState = {
  completed: boolean;
  completedAt?: string;
  lastStepSeen: number;
};

export type OnboardingTask = {
  id: string;
  label: string;
  description: string;
  href: string;
  autoComplete?: (plan: Plan) => boolean;
};

function onboardingKey() {
  const scope = getStorageScope();
  return scope === "default" ? ONBOARDING_KEY : `${ONBOARDING_KEY}::${scope}`;
}

function wizardKey() {
  const scope = getStorageScope();
  return scope === "default" ? WIZARD_KEY : `${WIZARD_KEY}::${scope}`;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  dismissed: false,
  completed: {},
};

export const DEFAULT_WIZARD_STATE: WizardState = {
  completed: false,
  lastStepSeen: 0,
};

export const ONBOARDING_TASKS: OnboardingTask[] = [
  {
    id: "period",
    label: "Confirm your period dates",
    description: "Make sure the current period matches your pay cycle.",
    href: "/settings",
    autoComplete: (plan) =>
      plan.periods.some((period, idx) => period.start !== PLAN.periods[idx]?.start || period.end !== PLAN.periods[idx]?.end),
  },
  {
    id: "income",
    label: "Add income rules",
    description: "Capture salary, side income, and any recurring inflows.",
    href: "/income",
    autoComplete: (plan) => plan.incomeRules.length > 0,
  },
  {
    id: "outflows",
    label: "Add outflows and bills",
    description: "Set bills, giving, savings, and variable caps.",
    href: "/bills",
    autoComplete: (plan) => plan.outflowRules.length > 0 || plan.bills.length > 0,
  },
  {
    id: "transactions",
    label: "Log real transactions",
    description: "Enter what actually happened so insights stay accurate.",
    href: "/transactions",
    autoComplete: (plan) => plan.transactions.length > 0,
  },
  {
    id: "insights",
    label: "Review Insights",
    description: "Check pace, risks, and next-step recommendations.",
    href: "/insights",
  },
];

export function loadOnboardingState(): OnboardingState {
  if (typeof window === "undefined") return DEFAULT_ONBOARDING_STATE;
  const raw = window.localStorage.getItem(onboardingKey());
  if (!raw) return DEFAULT_ONBOARDING_STATE;
  try {
    const parsed = JSON.parse(raw) as OnboardingState;
    return {
      dismissed: Boolean(parsed.dismissed),
      completed: parsed.completed ?? {},
    };
  } catch {
    return DEFAULT_ONBOARDING_STATE;
  }
}

export function saveOnboardingState(state: OnboardingState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(onboardingKey(), JSON.stringify(state));
  touchPreferencesUpdatedAt();
}

export function setOnboardingTask(id: string, completed: boolean) {
  const current = loadOnboardingState();
  const next: OnboardingState = {
    ...current,
    completed: { ...current.completed, [id]: completed },
  };
  saveOnboardingState(next);
  return next;
}

export function dismissOnboarding(dismissed: boolean) {
  const current = loadOnboardingState();
  const next: OnboardingState = { ...current, dismissed };
  saveOnboardingState(next);
  return next;
}

export function resetOnboarding() {
  saveOnboardingState(DEFAULT_ONBOARDING_STATE);
  return DEFAULT_ONBOARDING_STATE;
}

/* ── Wizard state (educational overlay, separate from checklist) ── */

export function loadWizardState(): WizardState {
  if (typeof window === "undefined") return DEFAULT_WIZARD_STATE;
  const raw = window.localStorage.getItem(wizardKey());
  if (!raw) return DEFAULT_WIZARD_STATE;
  try {
    return JSON.parse(raw) as WizardState;
  } catch {
    return DEFAULT_WIZARD_STATE;
  }
}

export function saveWizardState(state: WizardState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(wizardKey(), JSON.stringify(state));
  touchPreferencesUpdatedAt();
}

export function completeWizard(): WizardState {
  const next: WizardState = {
    completed: true,
    completedAt: new Date().toISOString(),
    lastStepSeen: 6,
  };
  saveWizardState(next);
  return next;
}

export function resetWizard(): WizardState {
  saveWizardState(DEFAULT_WIZARD_STATE);
  return DEFAULT_WIZARD_STATE;
}

/* ── Wizard plan builder ── */

export type WizardPlanParams = {
  income: string;
  hasBills: boolean | null;
  periodStartDay: number;
  periodCadence: PeriodCadence;
  mode: "forecast" | "track" | null;
};

export function buildPlanFromWizard(params: WizardPlanParams): Plan {
  const { income, hasBills, periodStartDay, periodCadence, mode } = params;
  const today = new Date().toISOString().split("T")[0];
  const incomeAmount = Number(income) || 0;

  const incomeRule: IncomeRule = {
    id: "primary-income",
    label: "Monthly Income",
    amount: incomeAmount,
    cadence: "monthly",
    seedDate: today,
    enabled: true,
  };

  const bills: BillTemplate[] = hasBills ? DEFAULT_BILLS : [];

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), periodStartDay);
  const periodStartStr = periodStart.toISOString().split("T")[0];
  const periodCount = periodCadence === "weekly" ? 26 : periodCadence === "biweekly" ? 13 : 12;
  const periods = generatePeriods(periodStartStr, periodCadence, periodCount);

  return {
    version: PLAN_VERSION,
    setup: {
      selectedPeriodId: 1,
      asOfDate: today,
      autoUpdateAsOfDate: true,
      windowDays: 30,
      startingBalance: 0,
      rollForwardBalance: mode === "track",
      expectedMinBalance: 0,
      variableCap: 0,
    },
    periods,
    incomeRules: [incomeRule],
    outflowRules: [],
    periodRuleOverrides: [],
    bills,
    periodOverrides: [],
    eventOverrides: [],
    overrides: [],
    transactions: [],
    savingsGoals: [],
  };
}
