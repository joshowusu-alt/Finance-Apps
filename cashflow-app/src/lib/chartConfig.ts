/**
 * Chart configuration with Midnight Gold Velanovo colors
 * Premium navy & gold theme for Recharts components
 */

export const chartColors = {
  // Primary colors (Hybrid Palette)
  primary: "#0ea5e9",       // Sky 500 - Sapphire Blue
  secondary: "#fbbf24",     // Amber 400 - Gold
  success: "#10b981",       // Emerald 500
  warning: "#f59e0b",       // Amber 500
  error: "#ef4444",         // Red 500
  info: "#3b82f6",          // Blue 500
  gold: "#fbbf24",          // Gold

  // Gradient accent
  gradient: "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)",
  gradientStart: "#0ea5e9",
  gradientEnd: "#3b82f6",

  // Chart-specific colors (Sapphire/Gold compatible)
  chart1: "#0ea5e9",        // Sky Blue (Primary)
  chart2: "#10b981",        // Emerald
  chart3: "#fbbf24",        // Gold
  chart4: "#ef4444",        // Red
  chart5: "#8b5cf6",        // Violet
  chart6: "#06b6d4",        // Cyan
  chart7: "#ec4899",          // Pink
  chart8: "#14b8a6",          // Teal

  // Finance semantic colors
  income: "#22c55e",          // Green = money in
  expense: "#dc2626",         // Red = money out
  transfer: "#1e293b",        // Navy = transfers
  savings: "#3b82f6",         // Blue = savings

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

// Category-specific colors
export const categoryColors: Record<string, string> = {
  // Key Categories (User requested distinction)
  bills: chartColors.warning,      // Gold/Amber for Bills
  allowance: chartColors.info,     // Blue for Allowance
  flexible: chartColors.chart5,    // Purple for Flex
  savings: chartColors.success,    // Green for Savings
  buffer: chartColors.chart6,      // Cyan for Buffer

  // Income
  salary: chartColors.success,
  income: chartColors.success,
  freelance: chartColors.info,

  // Housing
  rent: chartColors.error,
  mortgage: chartColors.error,
  utilities: chartColors.warning,

  // Food
  groceries: chartColors.chart6,   // Cyan
  restaurants: chartColors.chart7, // Pink
  dining: chartColors.chart7,

  // Transportation
  transport: chartColors.chart5,
  car: chartColors.chart5,
  gas: chartColors.warning,

  // Entertainment
  entertainment: chartColors.chart8, // Teal
  subscriptions: chartColors.primary,

  // Default
  other: chartColors.muted.light,
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

// Format currency for tooltips
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

// Get color for category
export function getCategoryColor(category: string): string {
  const key = category.toLowerCase().replace(/\s+/g, "");
  return categoryColors[key] || chartColors.chart1;
}
