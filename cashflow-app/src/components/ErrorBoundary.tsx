"use client";

import React from "react";
import { motion } from "framer-motion";
import * as Sentry from "@sentry/nextjs";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-(--vn-bg) px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-md w-full vn-card p-8 text-center"
          >
            {/* Animated Error Icon */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mb-6 text-6xl"
            >
              ⚠️
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-2xl font-bold text-(--vn-text) mb-3"
            >
              Oops! Something went wrong
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="text-sm text-(--vn-muted) mb-8 leading-relaxed"
            >
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
              Try refreshing the page or contact support if the problem persists.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="space-y-3"
            >
              <button
                onClick={() => window.location.reload()}
                className="button-premium w-full"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Page
                </span>
              </button>

              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="button-secondary w-full"
              >
                Try Again
              </button>

              <button
                onClick={() => {
                  if (window.confirm("Reset all app data? This cannot be undone.")) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.reload();
                  }
                }}
                className="vn-btn vn-btn-ghost w-full"
              >
                Reset app data
                <span className="block text-xs font-normal opacity-70 mt-0.5">Use if the app keeps crashing</span>
              </button>

              <button
                onClick={() => window.location.href = "/"}
                className="w-full text-sm text-(--vn-muted) hover:text-(--vn-text) transition-colors py-2"
              >
                Go to Dashboard
              </button>
            </motion.div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <motion.details
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="mt-8 text-left"
              >
                <summary className="cursor-pointer text-xs font-semibold text-soft hover:text-muted mb-3 transition-colors">
                  🔍 Error Details (Development Only)
                </summary>
                <pre className="text-xs text-(--error) bg-(--error-soft) p-4 rounded-lg overflow-auto max-h-48 font-mono border border-(--error)/20">
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </motion.details>
            )}
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-(--vn-bg) px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-md w-full vn-card p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
              className="mb-6 text-5xl"
            >
              ⚠️
            </motion.div>

            <h2 className="text-xl font-bold text-(--vn-text) mb-2">
              Page Error
            </h2>

            <p className="text-sm text-(--vn-muted) mb-6">
              This page encountered an error and couldn&apos;t load properly.
            </p>

            <button
              onClick={() => window.location.href = "/"}
              className="button-premium w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Go to Dashboard
              </span>
            </button>
          </motion.div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
