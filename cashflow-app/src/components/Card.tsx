"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  hover?: boolean;
  glass?: boolean;
  padding?: "sm" | "md" | "lg";
}

export function Card({
  children,
  hover = true,
  glass = false,
  padding = "lg",
  className = "",
  ...props
}: CardProps) {
  const paddingClasses = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={hover ? { y: -2 } : undefined}
      className={`
        card-premium
        ${paddingClasses[padding]}
        ${glass ? "backdrop-blur-xl bg-surface-elevated/80" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, subtitle, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3 flex-1">
        {icon && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="shrink-0"
          >
            {icon}
          </motion.div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-(--text-primary) truncate">{title}</h3>
          {subtitle && (
            <p className="text-sm text-(--text-secondary) mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: ReactNode;
  delay?: number;
}

export function StatCard({ label, value, change, trend, icon, delay = 0 }: StatCardProps) {
  const trendColors = {
    up: "text-success",
    down: "text-error",
    neutral: "text-(--text-tertiary)",
  };

  const trendBgs = {
    up: "bg-success-soft",
    down: "bg-error-soft",
    neutral: "bg-(--surface-soft)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="card-premium p-6 cursor-default"
    >
      {icon && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.2, type: "spring", stiffness: 200 }}
          className="mb-4"
        >
          {icon}
        </motion.div>
      )}

      <div className="text-xs font-semibold uppercase tracking-wide text-(--text-tertiary) mb-2">
        {label}
      </div>

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.1 }}
        className="text-3xl font-bold text-(--text-primary) mb-2"
      >
        {value}
      </motion.div>

      {change && trend && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.2 }}
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${trendBgs[trend]} ${trendColors[trend]}`}
        >
          {trend === "up" && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          )}
          {trend === "down" && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          <span>{change}</span>
        </motion.div>
      )}
    </motion.div>
  );
}

interface ProgressCardProps {
  label: string;
  current: number;
  total: number;
  percentage: number;
  color?: "blue" | "green" | "red" | "yellow";
  delay?: number;
}

export function ProgressCard({
  label,
  current,
  total,
  percentage,
  color = "blue",
  delay = 0,
}: ProgressCardProps) {
  const colors = {
    blue: "bg-accent",
    green: "bg-success",
    red: "bg-error",
    yellow: "bg-warning",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="card-premium p-6"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-(--text-secondary)">{label}</span>
        <span className="text-sm font-bold text-(--text-primary)">{Math.round(percentage)}%</span>
      </div>

      <div className="relative h-3 bg-(--surface-soft) rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 1, delay: delay + 0.2, ease: "easeOut" }}
          className={`absolute inset-y-0 left-0 ${colors[color]} rounded-full`}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-(--text-tertiary)">
        <span>{current.toFixed(0)}</span>
        <span>of {total.toFixed(0)}</span>
      </div>
    </motion.div>
  );
}

interface AlertCardProps {
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  action?: ReactNode;
  onDismiss?: () => void;
  delay?: number;
}

export function AlertCard({
  type,
  title,
  message,
  action,
  onDismiss,
  delay = 0,
}: AlertCardProps) {
  const styles = {
    info: {
      bg: "bg-info-soft",
      border: "border-info/30",
      icon: "text-info",
      iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    warning: {
      bg: "bg-warning-soft",
      border: "border-warning/30",
      icon: "text-warning",
      iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    },
    error: {
      bg: "bg-error-soft",
      border: "border-error/30",
      icon: "text-error",
      iconPath: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    success: {
      bg: "bg-success-soft",
      border: "border-success/30",
      icon: "text-success",
      iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  };

  const style = styles[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ duration: 0.3, delay }}
      className={`${style.bg} border ${style.border} rounded-xl p-4`}
    >
      <div className="flex items-start gap-3">
        <svg className={`w-5 h-5 ${style.icon} shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.iconPath} />
        </svg>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-(--text-primary) mb-1">{title}</h4>
          <p className="text-sm text-(--text-secondary)">{message}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>

        {onDismiss && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onDismiss}
            className="shrink-0 text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

/** Simple stat card used in detail pages (income, bills) */
export function SimpleStatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="vn-card p-6">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}
