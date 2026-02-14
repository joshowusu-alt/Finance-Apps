"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StepIndicator } from "./onboarding/StepIndicator";
import { WelcomeStep } from "./onboarding/steps/WelcomeStep";
import { GetStartedStep } from "./onboarding/steps/GetStartedStep";
import { completeWizard } from "@/lib/onboarding";
import { PLAN_VERSION, generatePeriods, fmtLabel, createSamplePlan } from "@/data/plan";
import type { Plan, BillTemplate, IncomeRule, PeriodCadence } from "@/data/plan";
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

const DEFAULT_BILLS: BillTemplate[] = [
  { id: "rent", label: "Rent / Mortgage", amount: 950, dueDay: 1, category: "bill", enabled: true },
  { id: "utilities", label: "Utilities", amount: 85, dueDay: 12, category: "bill", enabled: true },
  { id: "phone", label: "Phone", amount: 25, dueDay: 18, category: "bill", enabled: true },
  { id: "internet", label: "Internet", amount: 35, dueDay: 15, category: "bill", enabled: true },
];

const POPULAR_COUNTRIES: CountryCode[] = ["US", "GB", "CA", "AU", "IN", "DE", "NG", "GH", "ZA", "FR", "NZ", "KE"];

export default function OnboardingWizard({ onComplete }: QuickSetupProps) {
  /* -- Step navigation -- */
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);

  /* -- Step 1: Country -- */
  const [country, setCountryLocal] = useState<CountryCode>(() => getCountry());
  const [showAllCountries, setShowAllCountries] = useState(false);
  const currencySymbol = CURRENCIES[COUNTRIES[country]?.currency ?? "USD"]?.symbol ?? "$";

  /* -- Step 2: Pay cycle -- */
  const [periodCadence, setPeriodCadence] = useState<PeriodCadence>("monthly");
  const [periodStartDay, setPeriodStartDay] = useState<number>(1);

  /* -- Step 3: Income -- */
  const [income, setIncome] = useState("");
  const incomeRef = useRef<HTMLInputElement>(null);

  /* -- Step 4: Bills -- */
  const [hasBills, setHasBills] = useState<boolean | null>(null);

  /* -- Step 5: Mode -- */
  const [mode, setMode] = useState<"forecast" | "track" | null>(null);

  // Auto-focus income input
  useEffect(() => {
    if (step === 3) {
      setTimeout(() => incomeRef.current?.focus(), 400);
    }
  }, [step]);

  /* -- Select country AND persist immediately -- */
  const handleCountrySelect = useCallback(
    (code: CountryCode) => {
      setCountryLocal(code);
      persistCountry(code); // saves country + currency to localStorage right away
    },
    [],
  );

  /* -- Navigation -- */
  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const canAdvance =
    step === 0 || // Welcome
    (step === 1 && country in COUNTRIES) ||
    step === 2 || // pay cycle always has defaults
    (step === 3 && Number(income) > 0) ||
    (step === 4 && hasBills !== null) ||
    (step === 5 && mode !== null) ||
    step === 6; // All Set

  /* -- Build a fresh plan from wizard answers -- */
  function buildPlanFromWizard(): Plan {
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

  /* -- Final step handler -- */
  function handleGetStarted(choice: "fresh" | "sample") {
    completeWizard();
    if (choice === "sample") {
      onComplete(createSamplePlan());
    } else {
      onComplete(buildPlanFromWizard());
    }
  }

  /* -- Button label for current step -- */
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
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
      />

      {/* Dialog container */}
      <motion.div
        key="setup-container"
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        transition={SPRING}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8"
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
            <span className="text-xs text-[var(--vn-muted)]">Quick Setup</span>
          </div>

          {/* Step content (scrollable on mobile) */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-8 md:px-10 md:py-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={step} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">

                {/* Step 0: Welcome */}
                {step === 0 && <WelcomeStep />}

                {/* Step 1: Country */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--vn-text)]">Where are you based?</h2>
                      <p className="mt-2 text-sm text-[var(--vn-muted)]">This sets your currency and number format automatically.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {POPULAR_COUNTRIES.map((code) => {
                        const c = COUNTRIES[code];
                        return (
                          <button
                            key={code}
                            onClick={() => handleCountrySelect(code)}
                            className={`rounded-xl px-3 py-3 text-left transition-all border-2 ${
                              country === code
                                ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10"
                                : "border-[var(--vn-border)] hover:border-[var(--vn-primary)]/50"
                            }`}
                          >
                            <span className="text-xl">{c.flag}</span>
                            <div className="text-xs font-medium text-[var(--vn-text)] mt-1 truncate">{c.name}</div>
                            <div className="text-[10px] text-[var(--vn-muted)]">{CURRENCIES[c.currency].symbol} {c.currency}</div>
                          </button>
                        );
                      })}
                    </div>
                    {!showAllCountries ? (
                      <button
                        onClick={() => setShowAllCountries(true)}
                        className="text-xs text-[var(--vn-primary)] hover:underline"
                      >
                        Show all countries
                      </button>
                    ) : (
                      <select
                        value={country}
                        onChange={(e) => handleCountrySelect(e.target.value as CountryCode)}
                        className="w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-primary)]"
                      >
                        {Object.entries(COUNTRIES).map(([code, c]) => (
                          <option key={code} value={code}>
                            {c.flag} {c.name} ({CURRENCIES[c.currency].symbol} {c.currency})
                          </option>
                        ))}
                      </select>
                    )}
                    {country in COUNTRIES && (
                      <div className="flex items-center gap-2 rounded-lg bg-[var(--vn-primary)]/5 px-3 py-2 text-sm">
                        <span className="text-lg">{COUNTRIES[country].flag}</span>
                        <span className="font-medium text-[var(--vn-text)]">
                          {CURRENCIES[COUNTRIES[country].currency].symbol} {CURRENCIES[COUNTRIES[country].currency].name}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Pay cycle */}
                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--vn-text)]">When does your pay cycle start?</h2>
                      <p className="mt-2 text-sm text-[var(--vn-muted)]">We'll build budget periods around your pay dates.</p>
                    </div>

                    {/* Cadence picker */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--vn-muted)] mb-2 uppercase tracking-wider">How often are you paid?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["monthly", "biweekly", "weekly"] as PeriodCadence[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => setPeriodCadence(c)}
                            className={`rounded-xl px-3 py-3 text-sm font-medium transition-all border-2 ${
                              periodCadence === c
                                ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10"
                                : "border-[var(--vn-border)] hover:border-[var(--vn-primary)]/50"
                            }`}
                          >
                            {c === "monthly" ? "Monthly" : c === "biweekly" ? "Every 2 weeks" : "Weekly"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Start day picker */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--vn-muted)] mb-2 uppercase tracking-wider">
                        {periodCadence === "monthly" ? "What day of the month do you get paid?" : "What date did your last pay land?"}
                      </label>
                      {periodCadence === "monthly" ? (
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <button
                              key={day}
                              onClick={() => setPeriodStartDay(day)}
                              className={`rounded-lg py-2 text-sm font-medium transition-all ${
                                periodStartDay === day
                                  ? "bg-[var(--vn-primary)] text-white shadow-sm"
                                  : "hover:bg-[var(--vn-primary)]/10 text-[var(--vn-text)]"
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="date"
                          value={(() => {
                            const now = new Date();
                            const d = new Date(now.getFullYear(), now.getMonth(), periodStartDay);
                            return d.toISOString().split("T")[0];
                          })()}
                          onChange={(e) => {
                            const d = new Date(e.target.value + "T00:00:00");
                            if (!isNaN(d.getTime())) setPeriodStartDay(d.getDate());
                          }}
                          className="vn-input text-sm"
                        />
                      )}
                    </div>

                    {/* Preview */}
                    <div className="rounded-lg bg-[var(--vn-primary)]/5 px-4 py-3">
                      <div className="text-xs font-semibold text-[var(--vn-muted)] mb-1">Your first period will be</div>
                      <div className="text-sm font-bold text-[var(--vn-text)]">
                        {(() => {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth(), periodStartDay);
                          const startStr = start.toISOString().split("T")[0];
                          const preview = generatePeriods(startStr, periodCadence, 1)[0];
                          if (!preview) return "\u2014";
                          const s = new Date(preview.start + "T00:00:00");
                          const e = new Date(preview.end + "T00:00:00");
                          return `${fmtLabel(s)} \u2192 ${fmtLabel(e)}`;
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Income */}
                {step === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--vn-text)]">What's your monthly take-home pay?</h2>
                      <p className="mt-2 text-sm text-[var(--vn-muted)]">After tax, what lands in your account each month?</p>
                    </div>
                    <div className="relative">
                      <span
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold pointer-events-none"
                        style={{ zIndex: 1, color: "var(--vn-text)" }}
                      >
                        {currencySymbol}
                      </span>
                      <input
                        ref={incomeRef}
                        type="number"
                        inputMode="decimal"
                        value={income}
                        onChange={(e) => setIncome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && Number(income) > 0) goNext(); }}
                        placeholder="0"
                        className="vn-input text-2xl font-bold"
                        style={{ paddingLeft: "3rem", height: "4rem" }}
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Bills */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--vn-text)]">Do you have fixed monthly bills?</h2>
                      <p className="mt-2 text-sm text-[var(--vn-muted)]">Rent, utilities, phone things due on the same day each month.</p>
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
                        <div className="text-xs text-[var(--vn-muted)]">We'll add common ones you can edit later</div>
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

                {/* Step 5: Mode */}
                {step === 5 && (
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
