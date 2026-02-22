// Velanovo Design System — Private Wealth Cashflow OS
// Tone: Institutional · Measured · Executive · Understated power
export const velanovo = {
  colors: {
    // Core palette
    navy: "#111318",
    gold: "#C5A046",
    gold500: "#D4AF5A",
    goldSoft: "rgba(197, 160, 70, 0.12)",

    // Light mode
    light: {
      bgApp: "#F6F5F2",
      surface1: "#FFFFFF",
      surface2: "#F1EFEA",
      borderSubtle: "rgba(0, 0, 0, 0.06)",
      textPrimary: "#111318",
      textSecondary: "#525A65",
      textTertiary: "#8C94A3",
    },

    // Dark mode
    dark: {
      bgApp: "#0D1117",
      surface1: "#111827",
      surface2: "#141C26",
      surfaceElevated: "#1A2430",
      borderSubtle: "rgba(255, 255, 255, 0.06)",
      textPrimary: "#E6E8EB",
      textSecondary: "#AAB2BD",
      textTertiary: "#7D8793",
    },

    // Semantic — light
    success: "#2F7A55",
    successSoft: "rgba(47, 122, 85, 0.12)",
    risk: "#9E4E4E",
    riskSoft: "rgba(158, 78, 78, 0.12)",

    // Semantic — dark
    successDark: "#4FAF7B",
    successSoftDark: "rgba(79, 175, 123, 0.12)",
    riskDark: "#B85C5C",
    riskSoftDark: "rgba(184, 92, 92, 0.12)",
  },

  // 8px grid
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 },

  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    hero: 20,
    full: 9999,
  },

  typography: {
    serif: "'Playfair Display', Georgia, serif",
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    weights: { regular: 400, medium: 500, semibold: 600 },
    // 700 reserved for critical alerts only
  },

  motion: {
    micro: "120ms cubic-bezier(0.4, 0.0, 0.2, 1)",
    standard: "200ms cubic-bezier(0.4, 0.0, 0.2, 1)",
    panel: "280ms cubic-bezier(0.4, 0.0, 0.2, 1)",
    modal: "320ms cubic-bezier(0.4, 0.0, 0.2, 1)",
    // No bounce. No spring overshoot. No playful scaling.
  },
} as const;

export type VelanovoTheme = typeof velanovo;
