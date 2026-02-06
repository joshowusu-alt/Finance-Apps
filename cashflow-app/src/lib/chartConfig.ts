/**
 * Chart configuration with Gen Z Velanovo colors
 * Theme-aware colors for Recharts components
 */

export const chartColors = {
  // Primary colors (Gen Z palette)
  primary: "#6366f1",       // Soft indigo
  secondary: "#818cf8",     // Bright indigo glow
  success: "#10b981",       // Emerald
  warning: "#f59e0b",       // Amber
  error: "#ef4444",         // Red coral
  info: "#06b6d4",          // Cyan
  gold: "#fbbf24",          // Warm amber

  // Chart-specific colors (varied palette)
  chart1: "#6366f1",        // Soft indigo
  chart2: "#10b981",        // Emerald
  chart3: "#f59e0b",        // Amber
  chart4: "#ef4444",        // Red
  chart5: "#06b6d4",        // Cyan
  chart6: "#8b5cf6",        // Purple
  chart7: "#ec4899",        // Pink
  chart8: "#14b8a6",        // Teal

  // Neutrals
  text: {
    light: "#18181b",       // Zinc 900
    dark: "#fafafa",        // Soft white
  },
  muted: {
    light: "#71717a",       // Zinc 500
    dark: "#a1a1aa",        // Zinc 400
  },
  grid: {
    light: "#e4e4e7",       // Zinc 200
    dark: "#3f3f46",        // Zinc 700
  },
};

// Category-specific colors
export const categoryColors: Record<string, string> = {
  // Income
  salary: chartColors.success,
  income: chartColors.success,
  freelance: chartColors.info,

  // Housing
  rent: chartColors.error,
  mortgage: chartColors.error,
  utilities: chartColors.warning,

  // Food
  groceries: chartColors.chart6,
  restaurants: chartColors.chart7,
  dining: chartColors.chart7,

  // Transportation
  transport: chartColors.chart5,
  car: chartColors.chart5,
  gas: chartColors.warning,

  // Entertainment
  entertainment: chartColors.chart8,
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
