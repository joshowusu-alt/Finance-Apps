/**
 * OnboardingWizard component tests
 *
 * The wizard has many external dependencies (framer-motion, next/link, lib/,
 * hooks/, and every step sub-component).  We mock everything except the wizard
 * itself so tests focus on navigation logic and accessibility attributes.
 *
 * framer-motion is mocked globally in setup.ts.
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Plan } from "@/data/plan";

// ─── Dependency mocks (must be at module scope so vi.mock hoisting works) ─────

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/lib/currency", () => ({
  getCountry: () => "US",
  setCountry: vi.fn(),
  COUNTRIES: {
    US: { currency: "USD", name: "United States" },
    GB: { currency: "GBP", name: "United Kingdom" },
  },
  CURRENCIES: {
    USD: { symbol: "$", name: "US Dollar", locale: "en-US" },
    GBP: { symbol: "£", name: "British Pound", locale: "en-GB" },
  },
}));

vi.mock("@/lib/onboarding", () => ({
  completeWizard: vi.fn(),
  buildPlanFromWizard: vi.fn(() => ({ periods: [], transactions: [] } as unknown as Plan)),
}));

vi.mock("@/data/plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/plan")>();
  return {
    ...actual,
    createSamplePlan: vi.fn(() => ({ periods: [], transactions: [] } as unknown as Plan)),
  };
});

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("@/hooks/useBranding", () => ({
  useBranding: () => ({ name: "TestApp", primaryColor: "#000", accentColor: "#fff" }),
}));

// ── Step sub-components: render simple markers so tests can verify navigation ──

vi.mock("@/components/onboarding/StepIndicator", () => ({
  StepIndicator: ({ totalSteps, currentStep }: { totalSteps: number; currentStep: number }) => (
    <div data-testid="step-indicator" data-total={totalSteps} data-current={currentStep} />
  ),
}));

vi.mock("@/components/onboarding/steps/WelcomeStep", () => ({
  WelcomeStep: () => <div data-testid="step-welcome">Welcome Step</div>,
}));

vi.mock("@/components/onboarding/steps/CountryStep", () => ({
  CountryStep: () => <div data-testid="step-country">Country Step</div>,
}));

vi.mock("@/components/onboarding/steps/PayCycleStep", () => ({
  PayCycleStep: () => <div data-testid="step-paycycle">PayCycle Step</div>,
}));

vi.mock("@/components/onboarding/steps/IncomeInputStep", () => ({
  // Expose a button so tests can satisfy the income canAdvance guard
  IncomeInputStep: ({
    onIncomeChange,
  }: {
    income: string;
    onIncomeChange: (v: string) => void;
    onEnterPress: () => void;
    currencySymbol: string;
    inputRef: unknown;
  }) => (
    <div data-testid="step-income">
      <button onClick={() => onIncomeChange("2000")}>Enter income</button>
    </div>
  ),
}));

vi.mock("@/components/onboarding/steps/HasBillsStep", () => ({
  HasBillsStep: () => <div data-testid="step-bills">HasBills Step</div>,
}));

vi.mock("@/components/onboarding/steps/ModeStep", () => ({
  ModeStep: () => <div data-testid="step-mode">Mode Step</div>,
}));

vi.mock("@/components/onboarding/steps/GetStartedStep", () => ({
  GetStartedStep: ({ onComplete }: { onComplete: (c: "fresh" | "sample") => void }) => (
    <button onClick={() => onComplete("fresh")} data-testid="step-getstarted">
      Finish Setup
    </button>
  ),
}));

vi.mock("@/components/PlaidLink", () => ({
  default: () => <div data-testid="plaid-link">PlaidLink</div>,
}));

// ─── fetch stub (wizard calls /api/me on mount) ────────────────────────────────

beforeEach(() => {
  // Clear sessionStorage so the wizard always starts at step 0, regardless of
  // what a previous test may have written via the wizard's persistence effect.
  sessionStorage.clear();

  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: async () => null }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

import OnboardingWizard from "@/components/OnboardingWizard";

function renderWizard(onComplete = vi.fn()) {
  return render(<OnboardingWizard onComplete={onComplete} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OnboardingWizard", () => {
  it("renders as an accessible dialog", () => {
    renderWizard();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Quick setup");
  });

  it("shows step 0 (WelcomeStep) on first render", () => {
    renderWizard();
    expect(screen.getByTestId("step-welcome")).toBeInTheDocument();
  });

  it("step indicator is present with 8 total steps at step 0", () => {
    renderWizard();
    const indicator = screen.getByTestId("step-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-total", "8");
    expect(indicator).toHaveAttribute("data-current", "0");
  });

  it("has a disabled Back button at step 0", () => {
    renderWizard();
    const backBtn = screen.getByRole("button", { name: /back/i });
    expect(backBtn).toBeDisabled();
  });

  it("shows 'Get Started' as the next-button label on step 0", () => {
    renderWizard();
    expect(
      screen.getByRole("button", { name: /get started/i })
    ).toBeInTheDocument();
  });

  it("advances to step 1 (CountryStep) after clicking Get Started", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    expect(screen.queryByTestId("step-welcome")).not.toBeInTheDocument();
    expect(screen.getByTestId("step-country")).toBeInTheDocument();
  });

  it("shows 'Next' as the button label at step 1", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByRole("button", { name: /^next$/i })).toBeInTheDocument();
  });

  it("Back button is enabled at step 1", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByRole("button", { name: /back/i })).not.toBeDisabled();
  });

  it("step indicator reflects step 1", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByTestId("step-indicator")).toHaveAttribute("data-current", "1");
  });

  it("clicking Back from step 1 returns to step 0 (WelcomeStep)", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByTestId("step-country")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByTestId("step-welcome")).toBeInTheDocument();
    expect(screen.queryByTestId("step-country")).not.toBeInTheDocument();
  });

  it("clicking Back repeatedly stops at step 0", () => {
    renderWizard();
    // Ensure we are actually at step 0 already (can't go below it)
    const backBtn = screen.getByRole("button", { name: /back/i });
    expect(backBtn).toBeDisabled();
    // Cannot trigger — disabled buttons don't fire click events
  });

  it("can navigate forward through multiple steps", () => {
    renderWizard();
    // Step 0 → 1
    fireEvent.click(screen.getByRole("button", { name: /get started/i }));
    expect(screen.getByTestId("step-country")).toBeInTheDocument();

    // Step 1 → 2
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByTestId("step-paycycle")).toBeInTheDocument();

    // Step indicator reflects step 2
    expect(screen.getByTestId("step-indicator")).toHaveAttribute("data-current", "2");
  });

  it("calls onComplete when the user finishes the wizard via GetStartedStep", async () => {
    const onComplete = vi.fn();

    // Seed sessionStorage so the wizard restores directly to the final step (7).
    // beforeEach already cleared sessionStorage, so this is the only entry.
    sessionStorage.setItem(
      "onboarding_wizard_state",
      JSON.stringify({
        step: 7,
        country: "US",
        periodCadence: "monthly",
        periodStartDay: 1,
        income: "3000",
        hasBills: true,
        mode: "forecast",
      })
    );

    render(<OnboardingWizard onComplete={onComplete} />);

    // Let useEffects (restore + persist) settle
    await act(async () => Promise.resolve());

    // GetStartedStep mock renders a "Finish Setup" button
    expect(screen.getByTestId("step-getstarted")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));
    });

    expect(onComplete).toHaveBeenCalledOnce();
  });
});
