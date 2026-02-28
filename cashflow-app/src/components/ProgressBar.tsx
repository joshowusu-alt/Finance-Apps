"use client";

interface ProgressBarProps {
  value: number;
  /** Maximum / total value */
  max: number;
  /**
   * - "good": green bar
   * - "warn": yellow/amber bar
   * - "bad": red bar
   * - "auto": derives tone from value/max ratio (>100% = bad, >80% = warn, else neutral)
   * - "favorable": green when over, red when under budget (income-style)
   */
  tone?: "good" | "warn" | "bad" | "auto" | "favorable";
  label?: string;
  hint?: string;
  /** Bar track height. "sm" = 6px (h-1.5), "md" = 8px (h-2). Default "sm". */
  height?: "sm" | "md";
  /** Optional inline color override (CSS color string) */
  barColor?: string;
  className?: string;
}

export function ProgressBar({
  value,
  max,
  tone = "auto",
  label,
  hint,
  height = "sm",
  barColor,
  className = "",
}: ProgressBarProps) {
  if (max <= 0) return null;
  const pct = Math.min((value / max) * 100, 100);
  const ratio = value / max;

  function resolveColor(): string {
    if (barColor) return barColor;
    switch (tone) {
      case "good":      return "var(--vn-success, #22c55e)";
      case "bad":       return "var(--vn-error, #ef4444)";
      case "warn":      return "var(--vn-warning, #eab308)";
      case "favorable": return value > max ? "var(--vn-success, #22c55e)" : "var(--vn-error, #ef4444)";
      case "auto":
      default:
        if (ratio > 1)    return "var(--vn-error, #ef4444)";
        if (ratio > 0.8)  return "var(--vn-warning, #eab308)";
        return "var(--vn-primary, #4f9cf9)";
    }
  }

  const trackH = height === "md" ? "h-2" : "h-1.5";

  return (
    <div className={className}>
      {(label || hint) && (
        <div className="flex justify-between items-baseline mb-1">
          {label && <span className="text-xs" style={{ color: "var(--vn-muted)" }}>{label}</span>}
          {hint  && <span className="text-xs" style={{ color: "var(--vn-muted)" }}>{hint}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className={`${trackH} rounded-full overflow-hidden`}
        style={{ background: "var(--vn-border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: resolveColor() }}
        />
      </div>
    </div>
  );
}
