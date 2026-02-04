import type { Plan } from "@/data/plan";
import { PLAN } from "@/data/plan";
import { getStorageScope } from "@/lib/storage";

const ONBOARDING_KEY = "cashflow_onboarding_v1";

export type OnboardingState = {
  dismissed: boolean;
  completed: Record<string, boolean>;
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

const DEFAULT_STATE: OnboardingState = {
  dismissed: false,
  completed: {},
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
    href: "/settings",
    autoComplete: (plan) => plan.incomeRules.length > 0,
  },
  {
    id: "outflows",
    label: "Add outflows and bills",
    description: "Set bills, giving, savings, and variable caps.",
    href: "/settings",
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
  if (typeof window === "undefined") return DEFAULT_STATE;
  const raw = window.localStorage.getItem(onboardingKey());
  if (!raw) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(raw) as OnboardingState;
    return {
      dismissed: Boolean(parsed.dismissed),
      completed: parsed.completed ?? {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveOnboardingState(state: OnboardingState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(onboardingKey(), JSON.stringify(state));
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
  saveOnboardingState(DEFAULT_STATE);
  return DEFAULT_STATE;
}
