"use client";

import React from "react";
import { motion } from "framer-motion";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: string;
  illustration?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon = "📭",
  illustration,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {/* Icon or Illustration */}
      {illustration ? (
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.8 }}
          transition={{
            delay: 0.15,
            duration: 0.32,
            ease: [0.4, 0.0, 0.2, 1],
          }}
          className="mb-6"
        >
          {illustration}
        </motion.div>
      ) : (
        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.8 }}
          transition={{
            delay: 0.15,
            duration: 0.32,
            ease: [0.4, 0.0, 0.2, 1],
          }}
          className="text-7xl mb-6 opacity-80"
        >
          {icon}
        </motion.div>
      )}

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-xl font-bold text-(--vn-text) mb-2"
      >
        {title}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-sm text-(--vn-muted) max-w-md leading-relaxed mb-8"
      >
        {description}
      </motion.p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="flex flex-wrap gap-3 justify-center"
        >
          {action && (
            <Button
              onClick={action.onClick}
              variant="primary"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="secondary">
              {secondaryAction.label}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// Specialized empty states
export function NoDataEmptyState({ onImport }: { onImport?: () => void }) {
  return (
    <EmptyState
      illustration={
        <svg className="w-24 h-24 text-(--text-tertiary)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      }
      title="No Data Yet"
      description="Get started by adding your first transaction or importing data from your bank."
      action={
        onImport
          ? {
              label: "Import Data",
              onClick: onImport,
            }
          : undefined
      }
    />
  );
}

export function NoResultsEmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <EmptyState
      icon="🔍"
      title="No Results Found"
      description="We couldn't find anything matching your search. Try adjusting your filters or search terms."
      action={
        onReset
          ? {
              label: "Clear Filters",
              onClick: onReset,
            }
          : undefined
      }
    />
  );
}

export function ErrorEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon="⚠️"
      title="Something Went Wrong"
      description="We encountered an error while loading this data. Please try again."
      action={
        onRetry
          ? {
              label: "Try Again",
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}
