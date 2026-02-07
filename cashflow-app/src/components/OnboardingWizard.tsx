"use client";

import { useState, useEffect, useCallback, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StepIndicator } from "./onboarding/StepIndicator";
import { WelcomeStep } from "./onboarding/steps/WelcomeStep";
import { PeriodsStep } from "./onboarding/steps/PeriodsStep";
import { IncomeStep } from "./onboarding/steps/IncomeStep";
import { BillsVsOutflowsStep } from "./onboarding/steps/BillsVsOutflowsStep";
import { TransactionsStep } from "./onboarding/steps/TransactionsStep";
import { InsightsStep } from "./onboarding/steps/InsightsStep";
import { GetStartedStep } from "./onboarding/steps/GetStartedStep";
import {
  loadWizardState,
  saveWizardState,
  completeWizard,
} from "@/lib/onboarding";

type OnboardingWizardProps = {
  onComplete: (choice: "fresh" | "sample" | "skip") => void;
};

const SPRING_GENTLE = { type: "spring" as const, stiffness: 300, damping: 25 };

/* Step definitions — each step is a simple component; the last one receives onComplete */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StepDef = {
  component: ComponentType<any>;
  needsComplete?: boolean;
};

const STEPS: StepDef[] = [
  { component: WelcomeStep },
  { component: PeriodsStep },
  { component: IncomeStep },
  { component: BillsVsOutflowsStep },
  { component: TransactionsStep },
  { component: InsightsStep },
  { component: GetStartedStep, needsComplete: true },
];

const TOTAL_STEPS = STEPS.length;

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: SPRING_GENTLE,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.2 },
  }),
};

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  // Save progress as user navigates
  useEffect(() => {
    const state = loadWizardState();
    if (currentStep > state.lastStepSeen) {
      saveWizardState({ ...state, lastStepSeen: currentStep });
    }
  }, [currentStep]);

  // Lock body scroll + keyboard nav
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && !isLastStep) goNext();
      if (e.key === "ArrowLeft" && !isFirstStep) goBack();
      if (e.key === "Escape") handleSkip();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isFirstStep, isLastStep]);

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    completeWizard();
    onComplete("skip");
  }, [onComplete]);

  const handleComplete = useCallback(
    (choice: "fresh" | "sample") => {
      completeWizard();
      onComplete(choice);
    },
    [onComplete],
  );

  const step = STEPS[currentStep];
  const StepComponent = step.component;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="wizard-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
      />

      {/* Wizard container */}
      <motion.div
        key="wizard-container"
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 30 }}
        transition={SPRING_GENTLE}
        className="fixed inset-0 z-[61] flex items-center justify-center p-4 md:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding wizard"
      >
        <div
          className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
          style={{
            background: "var(--vn-surface)",
            border: "1px solid var(--vn-border)",
          }}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--vn-border)" }}
          >
            <StepIndicator totalSteps={TOTAL_STEPS} currentStep={currentStep} />
            <button
              onClick={handleSkip}
              className="text-xs font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--vn-muted)" }}
            >
              Skip
            </button>
          </div>

          {/* Step content — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <StepComponent
                  {...(step.needsComplete ? { onComplete: handleComplete } : {})}
                />
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
              disabled={isFirstStep}
              className="vn-btn vn-btn-ghost text-sm disabled:opacity-0 disabled:pointer-events-none transition-opacity"
            >
              Back
            </button>

            {!isLastStep && (
              <motion.button
                onClick={goNext}
                className="vn-btn vn-btn-primary text-sm"
                whileTap={{ scale: 0.98 }}
              >
                Next
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
