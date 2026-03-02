/**
 * Velanovo Copy Map
 * Single source of truth for all user-facing strings.
 * Tone: Calm · Private-banking · Human-first · Predictive
 */

// ── Confidence tier display labels ──────────────────────────────────────────
export const TIER_LABELS = {
  Secure:       "Secure",
  Stable:       "Stable",
  "Watch zone": "Watch zone",
  "Tight zone": "Tight zone",
} as const;

// ── Confidence tier explanations ─────────────────────────────────────────────
export const TIER_EXPLANATIONS = {
  "Tight zone": {
    negativeForecast:
      "Your balance looks set to dip below zero before the period ends — adjusting a bill or timing income earlier would help.",
    multipleRiskDays:
      "Several days are forecast below your safety net — small adjustments now will protect you.",
    spendingAhead:
      "You're spending a bit faster than usual this period. If nothing changes, the end of the period could feel tight.",
  },
  "Watch zone": {
    riskDays:
      "A balance dip is in the forecast — keep your spending pace steady and consider a small trim.",
    moderatelyAhead:
      "Spending is running a bit ahead of plan — a small adjustment would bring you back on track.",
    default:
      "Your balance gets close to your safety net this period. Worth keeping an eye on your pace.",
  },
  Stable: {
    streak:
      "Consistent savings are supporting your score — keep the streak going.",
    default:
      "Looking steady. Keep an eye on your spending pace as the period moves on.",
  },
  Secure: {
    improving:
      "Your plan is working — strong liquidity and an improving spending trend are lifting your score.",
    default:
      "Strong liquidity and a steady spending pace are keeping you here.",
  },
} as const;

// ── Today Lens block ─────────────────────────────────────────────────────────
// {amount} and {date} are replaced at render time.
export const TODAY_LENS_COPY: Record<string, { predictive: string; action: string }> = {
  Secure: {
    predictive:
      "If nothing changes, you'll finish around £{amount} — a comfortable position.",
    action:
      "This week: you're comfortably on pace — no changes needed.",
  },
  Stable: {
    predictive:
      "If nothing changes, you'll finish around £{amount} — your tightest day is {date}.",
    action:
      "This week: maintain your current spending pace.",
  },
  "Watch zone": {
    predictive:
      "If nothing changes, you'll finish around £{amount} — your tightest day is {date}, worth watching.",
    action:
      "This week: aim to reduce spending by about £{amount} to stay on track.",
  },
  "Tight zone": {
    predictive:
      "If nothing changes, you'll finish around £{amount} — your tightest day is {date}.",
    action:
      "This week: reduce discretionary spending by £{amount} to avoid a late-period squeeze.",
  },
};

// ── Home screen copy ─────────────────────────────────────────────────────────
export const HOME_COPY = {
  // Masthead
  pageTitle:            "Your Money, This Period",
  safeToSpendLabel:     "Safe to Spend",
  safeToSpendTooltip:
    "Income received so far minus your spending and savings. This is yours to use — without going over.",
  safeToSpendSubtext:   "Available to spend this period",
  noIncomeWarning:
    "No income logged yet — add income to see your full picture.",

  // Spending pace
  spendingPaceHigh:    "Running a bit ahead",
  spendingPaceGood:    "Pacing well",
  spendingPaceOk:      "On track",
  spendingPaceBelow:   "Running below plan",
  spendingPaceTooltip:
    "Expected pace accounts for bill due dates — so early rent or utilities don't look like overspending.",

  // Primary recommendation headings
  urgencyHigh:   "One thing to do",
  urgencyMedium: "Worth a look",
  urgencyLow:    "You're on track",

  // Cashflow chart
  chartHeading:  "Cashflow Forecast",
  chartSubtext:  "Projected balance for next 30 days",
  chartCaption:
    "This shows your expected balance day-by-day. The shaded area is your safety buffer.",

  // Collapsible section
  confidenceSectionTitle: "Financial Confidence Score",

  // Subscriptions
  subSummaryTitle:  "Recurring charges on your account",
  subSummaryDetail: (count: number) =>
    `${count} subscription${count !== 1 ? "s" : ""} detected — review to save money`,

  // Progress strip
  riskDaysLabel: "Low-balance days",
} as const;
