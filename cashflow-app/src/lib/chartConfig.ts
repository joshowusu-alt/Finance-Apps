/**
 * Chart configuration with Midnight Gold Velanovo colors
 * Premium navy & gold theme for Recharts components
 */

export const chartColors = {
  // Primary colors - Highly Distinct Palette
  primary: "#0ea5e9",       // Sky 500 - Sapphire Blue
  secondary: "#fbbf24",     // Amber 400 - Gold
  success: "#22c55e",       // Green 500 - Bright Green
  warning: "#f97316",       // Orange 500 - Vivid Orange
  error: "#ef4444",         // Red 500
  info: "#3b82f6",          // Blue 500
  gold: "#fbbf24",          // Gold

  // Gradient accent
  gradient: "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)",
  gradientStart: "#0ea5e9",
  gradientEnd: "#3b82f6",

  // Chart-specific colors - HIGHLY DISTINCT for visual clarity
  chart1: "#3b82f6",        // Blue - Strong blue
  chart2: "#22c55e",        // Green - Bright green
  chart3: "#f97316",        // Orange - Vivid orange
  chart4: "#ef4444",        // Red - Clear red
  chart5: "#a855f7",        // Purple - Vibrant purple
  chart6: "#06b6d4",        // Cyan - Bright cyan
  chart7: "#ec4899",        // Pink - Hot pink
  chart8: "#84cc16",        // Lime - Lime green

  // Finance semantic colors - DISTINCT
  income: "#22c55e",          // Green = money in
  expense: "#ef4444",         // Red = money out
  transfer: "#64748b",        // Slate = transfers
  savings: "#a855f7",         // Purple = savings (distinct from income)

  // Neutrals (Slate palette)
  text: {
    light: "#0f172a",         // Slate 900
    dark: "#f8fafc",          // Slate 50
  },
  muted: {
    light: "#64748b",         // Slate 500
    dark: "#94a3b8",          // Slate 400
  },
  grid: {
    light: "#e2e8f0",         // Slate 200
    dark: "#334155",          // Slate 700
  },
};

// Category-specific colors - HIGHLY DISTINCT for easy identification
export const categoryColors: Record<string, string> = {
  // Key Spending Categories - Each visually unique
  bill: "#3b82f6",             // Blue - Bills are a primary concern
  bills: "#3b82f6",            // Blue
  allowance: "#22c55e",        // Green - Personal spending money
  giving: "#f97316",           // Orange - Charitable/gifts (warm, generous)
  savings: "#a855f7",          // Purple - Savings (wealth building)
  buffer: "#06b6d4",           // Cyan - Emergency/buffer funds
  flexible: "#ec4899",         // Pink - Flexible spending
  other: "#64748b",            // Slate - Miscellaneous

  // Income types
  salary: "#22c55e",           // Green
  income: "#22c55e",           // Green
  freelance: "#84cc16",        // Lime - Side income

  // Housing
  rent: "#ef4444",             // Red - Major expense
  mortgage: "#ef4444",         // Red
  utilities: "#f97316",        // Orange

  // Food
  groceries: "#06b6d4",        // Cyan
  restaurants: "#ec4899",      // Pink
  dining: "#ec4899",           // Pink

  // Transportation
  transport: "#a855f7",        // Purple
  car: "#a855f7",              // Purple
  gas: "#f97316",              // Orange

  // Entertainment
  entertainment: "#ec4899",    // Pink
  subscriptions: "#3b82f6",    // Blue
};

// Get theme-aware text color
export function getTextColor(isDark: boolean): string {
  return isDark ? chartColors.text.dark : chartColors.text.light;
}

// Get theme-aware muted color
export function getMutedColor(isDark: boolean): string {
  return isDark ? chartColors.muted.dark : chartColors.muted.light;
}

// Get theme-aware grid color
export function getGridColor(isDark: boolean): string {
  return isDark ? chartColors.grid.dark : chartColors.grid.light;
}

// Chart configuration presets
export const chartConfig = {
  margin: { top: 10, right: 10, left: 0, bottom: 0 },
  animationDuration: 400,
  animationEasing: "ease-out" as const,
};

// Re-export currency helpers for chart tooltips and axis ticks
export { formatMoney as formatCurrency, formatCompactCurrency, getCurrencySymbol } from "@/lib/currency";

// Format percentage
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

// Get color for category
export function getCategoryColor(category: string): string {
  const key = category.toLowerCase().replace(/\s+/g, "");
  return categoryColors[key] || chartColors.chart1;
}
