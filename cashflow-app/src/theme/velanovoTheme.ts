export const velanovo = {
  colors: {
    // Gen Z Brand Colors
    navy: "#18181b",      // Zinc 900 - soft dark
    teal: "#6366f1",      // Soft indigo - Gen Z favorite
    gold: "#fbbf24",      // Warm amber

    // Light Mode
    light: {
      bg: "#f5f5f7",      // Soft warm gray - Apple-style
      surface: "#ffffff", // Pure white cards
      border: "#e4e4e7",  // Zinc 200
      text: "#18181b",    // Zinc 900
      muted: "#71717a",   // Zinc 500
    },

    // Dark Mode
    dark: {
      bg: "#18181b",      // Zinc 900 - warm dark
      surface: "#27272a", // Zinc 800
      border: "#3f3f46",  // Zinc 700
      text: "#fafafa",    // Soft white
      muted: "#a1a1aa",   // Zinc 400
    },

    // Semantic
    success: "#10b981",   // Emerald
    warning: "#f59e0b",   // Amber
    error: "#ef4444",     // Red coral
    info: "#06b6d4",      // Cyan
  },
  radii: { sm: 12, md: 18, lg: 24, pill: 999 },
} as const;

export type VelanovoTheme = typeof velanovo;
