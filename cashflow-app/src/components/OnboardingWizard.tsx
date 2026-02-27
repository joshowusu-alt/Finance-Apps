"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { StepIndicator } from "./onboarding/StepIndicator";
import { WelcomeStep } from "./onboarding/steps/WelcomeStep";
import { GetStartedStep } from "./onboarding/steps/GetStartedStep";
import { CountryStep } from "./onboarding/steps/CountryStep";
import { PayCycleStep } from "./onboarding/steps/PayCycleStep";
import { IncomeInputStep } from "./onboarding/steps/IncomeInputStep";
import { HasBillsStep } from "./onboarding/steps/HasBillsStep";
import { ModeStep } from "./onboarding/steps/ModeStep";
import { completeWizard, buildPlanFromWizard } from "@/lib/onboarding";
import { createSamplePlan } from "@/data/plan";
import type { Plan, PeriodCadence } from "@/data/plan";
import {
  COUNTRIES,
  CURRENCIES,
  getCountry,
  setCountry as persistCountry,
  type CountryCode,
} from "@/lib/currency";

type QuickSetupProps = {
  onComplete: (plan: Plan) => void;
};

const TOTAL_STEPS = 7;

const SPRING = { type: "spring" as const, stiffness: 300, damping: 25 };

const stepVariants = {
  enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1, transition: SPRING },
  exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0, scale: 0.96, transition: { duration: 0.2 } }),
};

type LocalStepData = {
  country: CountryCode;
  income: string;
  hasBills: boolean | null;
  mode: "forecast" | "track" | null;
};

const STEP_CONFIG: { canAdvance: (s: LocalStepData) => boolean }[] = [
  { canAdvance: () => true },                             // 0: Welcome
  { canAdvance: (s) => s.country in COUNTRIES },         // 1: Country
  { canAdvance: () => true },                             // 2: PayCycle (always has defaults)
  { canAdvance: (s) => Number(s.income) > 0 },           // 3: Income
  { canAdvance: (s) => s.hasBills !== null },             // 4: Bills
  { canAdvance: (s) => s.mode !== null },                 // 5: Mode
  { canAdvance: () => true },                             // 6: All Set
];

export default function OnboardingWizard({ onComplete }: QuickSetupProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [country, setCountryLocal] = useState<CountryCode>(() => getCountry());
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [periodCadence, setPeriodCadence] = useState<PeriodCadence>("monthly");
  const [periodStartDay, setPeriodStartDay] = useState<number>(1);
  const [income, setIncome] = useState("");
  const incomeRef = useRef<HTMLInputElement | null>(null);
  const [hasBills, setHasBills] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"forecast" | "track" | null>(null);

  const currencySymbol = CURRENCIES[COUNTRIES[country]?.currency ?? "USD"]?.symbol ?? "$";

  const shouldReduceMotion = useReducedMotion();
  const reducedMotionOverride = shouldReduceMotion
    ? { initial: false as const, animate: false as const, exit: {} }
    : {};

  useEffect(() => {
    if (step === 3) setTimeout(() => incomeRef.current?.focus(), 400);
  }, [step]);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('onboarding_wizard_state');
      if (saved) {
        const s = JSON.parse(saved);
        if (typeof s.step === 'number') setStep(s.step);
        if (s.country) { setCountryLocal(s.country); persistCountry(s.country); }
        if (s.periodCadence) setPeriodCadence(s.periodCadence);
        if (typeof s.periodStartDay === 'number') setPeriodStartDay(s.periodStartDay);
        if (typeof s.income === 'string') setIncome(s.income);
        if (s.hasBills !== undefined) setHasBills(s.hasBills);
        if (s.mode !== undefined) setMode(s.mode);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist wizard state to sessionStorage on every relevant change
  useEffect(() => {
    try {
      sessionStorage.setItem('onboarding_wizard_state', JSON.stringify({
        step, country, periodCadence, periodStartDay, income, hasBills, mode,
      }));
    } catch { /* ignore */ }
  }, [step, country, periodCadence, periodStartDay, income, hasBills, mode]);

  const handleCountrySelect = useCallback((code: CountryCode) => {
    setCountryLocal(code);
    persistCountry(code);
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const canAdvance = STEP_CONFIG[step]?.canAdvance({ country, income, hasBills, mode }) ?? false;

  function handleGetStarted(choice: "fresh" | "sample") {
    sessionStorage.removeItem('onboarding_wizard_state');
    completeWizard();
    if (choice === "sample") {
      onComplete(createSamplePlan());
    } else {
      onComplete(buildPlanFromWizard({ income, hasBills, periodStartDay, periodCadence, mode }));
    }
  }

  const nextLabel = step === 0 ? "Get Started" : "Next";

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="setup-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        {...reducedMotionOverride}
        className="fixed inset-0 z-60 bg-black/60 backdrop-blur-md"
      />

      {/* Dialog container */}
      <motion.div
        key="setup-container"
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        transition={SPRING}
        {...reducedMotionOverride}
        className="fixed inset-0 z-60 flex items-center justify-center p-4 md:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Quick setup"
      >
        <div
          className="relative w-full max-w-lg max-h-[90dvh] rounded-3xl shadow-2xl flex flex-col"
          style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--vn-border)" }}
          >
            <StepIndicator totalSteps={TOTAL_STEPS} currentStep={step} />
            <span className="text-xs text-(--vn-muted)">Quick Setup</span>
          </div>

          {/* Step content (scrollable on mobile) */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-8 md:px-10 md:py-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={step} custom={direction} variants={shouldReduceMotion ? undefined : stepVariants} initial={shouldReduceMotion ? false : "enter"} animate={shouldReduceMotion ? {} : "center"} exit={shouldReduceMotion ? {} : "exit"}>

                {step === 0 && <WelcomeStep />}

                {step === 1 && (
                  <CountryStep
                    country={country}
                    onSelect={handleCountrySelect}
                    showAllCountries={showAllCountries}
                    onShowAll={() => setShowAllCountries(true)}
                  />
                )}

                {step === 2 && (
                  <PayCycleStep
                    periodCadence={periodCadence}
                    onCadenceChange={setPeriodCadence}
                    periodStartDay={periodStartDay}
                    onStartDayChange={setPeriodStartDay}
                  />
                )}

                {step === 3 && (
                  <IncomeInputStep
                    income={income}
                    onIncomeChange={setIncome}
                    onEnterPress={goNext}
                    currencySymbol={currencySymbol}
                    inputRef={incomeRef}
                  />
                )}

                {step === 4 && <HasBillsStep hasBills={hasBills} onSelect={setHasBills} />}

                {step === 5 && <ModeStep mode={mode} onSelect={setMode} />}

                {/* Step 6: All Set */}
                {step === 6 && <GetStartedStep onComplete={handleGetStarted} />}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom navigation (hidden on final step; GetStartedStep has its own CTAs) */}
          {step < TOTAL_STEPS - 1 && (
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

              <motion.button
                onClick={goNext}
                disabled={!canAdvance}
                className="vn-btn vn-btn-primary text-sm disabled:opacity-40"
                whileTap={{ scale: 0.98 }}
              >
                {nextLabel}
              </motion.button>
            </div>
          )}

          {/* Back button on final step so users can still go back */}
          {step === TOTAL_STEPS - 1 && (
            <div
              className="flex items-center px-6 py-4 shrink-0"
              style={{ borderTop: "1px solid var(--vn-border)" }}
            >
              <button
                onClick={goBack}
                className="vn-btn vn-btn-ghost text-sm"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
