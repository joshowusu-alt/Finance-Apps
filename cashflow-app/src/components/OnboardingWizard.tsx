"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StepIndicator } from "./onboarding/StepIndicator";
import { completeWizard } from "@/lib/onboarding";
import { DEFAULT_PERIODS, PLAN_VERSION } from "@/data/plan";
import type { Plan, BillTemplate, IncomeRule } from "@/data/plan";

type QuickSetupProps = {
  onComplete: (plan: Plan) => void;
};

const SPRING = { type: "spring" as const, stiffness: 300, damping: 25 };

const stepVariants = {
  enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1, transition: SPRING },
  exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.96, transition: { duration: 0.2 } }),
};

const DEFAULT_BILLS: BillTemplate[] = [
  { id: "rent", label: "Rent / Mortgage", amount: 950, dueDay: 1, category: "bill", enabled: true },
  { id: "utilities", label: "Utilities", amount: 85, dueDay: 12, category: "bill", enabled: true },
  { id: "phone", label: "Phone", amount: 25, dueDay: 18, category: "bill", enabled: true },
  { id: "internet", label: "Internet", amount: 35, dueDay: 15, category: "bill", enabled: true },
];

export default function OnboardingWizard({ onComplete }: QuickSetupProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);

  // Q1: Income
  const [income, setIncome] = useState("");
  const incomeRef = useRef<HTMLInputElement>(null);

  // Q2: Bills
  const [hasBills, setHasBills] = useState<boolean | null>(null);

  // Q3: Mode
  const [mode, setMode] = useState<"forecast" | "track" | null>(null);

  // Auto-focus income input on step 0
  useEffect(() => {
    if (step === 0) {
      setTimeout(() => incomeRef.current?.focus(), 400);
    }
  }, [step]);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 2));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const canAdvance =
    (step === 0 && Number(income) > 0) ||
    (step === 1 && hasBills !== null) ||
    (step === 2 && mode !== null);

  function handleFinish() {
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

    const plan: Plan = {
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
      periods: DEFAULT_PERIODS,
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

    completeWizard();
    onComplete(plan);
  }

  return (
    <AnimatePresence>
      <motion.div
        key="setup-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-60 bg-black/60 backdrop-blur-md"
      />

      <motion.div
        key="setup-container"
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        transition={SPRING}
        className="fixed inset-0 z-60 flex items-center justify-center p-4 md:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Quick setup"
      >
        <div
          className="relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl flex flex-col"
          style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--vn-border)" }}
          >
            <StepIndicator totalSteps={3} currentStep={step} />
            <span className="text-xs text-[var(--vn-muted)]">Quick Setup</span>
          </div>

          {/* Step content */}
          <div className="flex-1 px-6 py-8 md:px-10 md:py-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={step} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">

                {/* Step 1: Income */}
                {step === 0 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--vn-text)]">What&apos;s your monthly take-home pay?</h2>
                      <p className="mt-2 text-sm text-[var(--vn-muted)]">After tax, what lands in your account each month?</p>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--vn-muted)]">&pound;</span>
                      <input
                        ref={incomeRef}
                        type="number"
                        inputMode="decimal"
                        value={income}
                        onChange={(e) => setIncome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && Number(income) > 0) goNext(); }}
                        placeholder="0"
                        className="vn-input text-2xl font-bold pl-10 h-16"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Bills */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--vn-text)]">Do you have fixed monthly bills?</h2>
                      <p className="mt-2 text-sm text-[var(--vn-muted)]">Rent, utilities, phone — things due on the same day each month.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setHasBills(true)}
                        className={`rounded-2xl p-5 text-left transition-all border-2 ${
                          hasBills === true
                            ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10"
                            : "border-[var(--vn-border)] hover:border-[var(--vn-primary)]/50"
                        }`}
                      >
                        <div className="text-2xl mb-2">Yes</div>
                        <div className="text-xs text-[var(--vn-muted)]">We&apos;ll add common ones you can edit later</div>
                      </button>
                      <button
                        onClick={() => setHasBills(false)}
                        className={`rounded-2xl p-5 text-left transition-all border-2 ${
                          hasBills === false
                            ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10"
                            : "border-[var(--vn-border)] hover:border-[var(--vn-primary)]/50"
                        }`}
                      >
                        <div className="text-2xl mb-2">No</div>
                        <div className="text-xs text-[var(--vn-muted)]">Start with just income, add bills later</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Mode */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--vn-text)]">How do you want to use the app?</h2>
                      <p className="mt-2 text-sm text-[var(--vn-muted)]">You can change this anytime in Settings.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <button
                        onClick={() => setMode("forecast")}
                        className={`rounded-2xl p-5 text-left transition-all border-2 ${
                          mode === "forecast"
                            ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10"
                            : "border-[var(--vn-border)] hover:border-[var(--vn-primary)]/50"
                        }`}
                      >
                        <div className="text-base font-semibold text-[var(--vn-text)]">Forecast ahead</div>
                        <div className="text-xs text-[var(--vn-muted)] mt-1">See projected balance based on your income, bills, and spending rules.</div>
                      </button>
                      <button
                        onClick={() => setMode("track")}
                        className={`rounded-2xl p-5 text-left transition-all border-2 ${
                          mode === "track"
                            ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10"
                            : "border-[var(--vn-border)] hover:border-[var(--vn-primary)]/50"
                        }`}
                      >
                        <div className="text-base font-semibold text-[var(--vn-text)]">Track as I go</div>
                        <div className="text-xs text-[var(--vn-muted)] mt-1">Log transactions and roll your actual balance forward each period.</div>
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom navigation */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderTop: "1px solid var(--vn-border)" }}
          >
            <button
              onClick={goBack}
              disabled={step === 0}
              className="vn-btn vn-btn-ghost text-sm disabled:opacity-0 disabled:pointer-events-none transition-opacity"
            >
              Back
            </button>

            {step < 2 ? (
              <motion.button
                onClick={goNext}
                disabled={!canAdvance}
                className="vn-btn vn-btn-primary text-sm disabled:opacity-40"
                whileTap={{ scale: 0.98 }}
              >
                Next
              </motion.button>
            ) : (
              <motion.button
                onClick={handleFinish}
                disabled={!canAdvance}
                className="vn-btn vn-btn-primary text-sm disabled:opacity-40"
                whileTap={{ scale: 0.98 }}
              >
                Build My Dashboard
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
