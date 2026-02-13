"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  fullWidth = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses = "relative inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs min-h-10",
    md: "px-4 py-2.5 text-sm min-h-11",
    lg: "px-6 py-3 text-base min-h-12",
  };

  const variantClasses = {
    primary: "button-premium focus:ring-accent",
    secondary: "button-secondary focus:ring-(--border-hover)",
    ghost: "text-(--text-primary) hover:bg-(--surface-soft) focus:ring-(--border)",
    danger: "bg-error text-white hover:bg-error/90 shadow-md hover:shadow-lg focus:ring-error",
  };

  return (
    <motion.button
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      disabled={disabled || loading}
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </motion.div>
      )}

      <span className={`flex items-center gap-2 ${loading ? "opacity-0" : ""}`}>
        {icon && iconPosition === "left" && icon}
        {children}
        {icon && iconPosition === "right" && icon}
      </span>
    </motion.button>
  );
}

interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function IconButton({
  icon,
  label,
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3",
  };

  const variantClasses = {
    primary: "bg-accent text-white hover:bg-accent-deep",
    secondary: "bg-(--surface-elevated) text-(--text-primary) hover:bg-(--surface-soft) border border-(--border)",
    ghost: "text-(--text-secondary) hover:bg-(--surface-soft) hover:text-(--text-primary)",
    danger: "bg-error/10 text-error hover:bg-error/20",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={label}
      title={label}
      className={`
        rounded-xl transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export function ButtonGroup({ children, className = "" }: ButtonGroupProps) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {children}
    </div>
  );
}
