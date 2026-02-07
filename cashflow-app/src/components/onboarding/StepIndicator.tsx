"use client";

import { motion } from "framer-motion";

export function StepIndicator({
  totalSteps,
  currentStep,
}: {
  totalSteps: number;
  currentStep: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="relative">
          <motion.div
            className="h-2 rounded-full"
            animate={{
              width: i === currentStep ? 24 : 8,
              background:
                i <= currentStep ? "var(--vn-primary)" : "var(--vn-border)",
              opacity: i <= currentStep ? 1 : 0.4,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          {i === currentStep && (
            <motion.div
              layoutId="wizardActiveStep"
              className="absolute -inset-1 rounded-full"
              style={{
                border: "2px solid var(--vn-primary)",
                opacity: 0.3,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
