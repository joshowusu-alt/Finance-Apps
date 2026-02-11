import type { Plan, CashflowEvent, Transaction } from "@/data/plan";
import { buildTimeline, generateEvents, getPeriod, getStartingBalance } from "@/lib/cashflowEngine";
import { getStorageScope } from "@/lib/storage";
import { touchPreferencesUpdatedAt } from "@/lib/preferencesSync";

export const ALERT_PREFS_UPDATED_EVENT = "cashflow:alerts-updated";

const ALERT_PREFS_KEY = "cashflow_alert_prefs_v1";

export type AlertPreferences = {
  enabled: boolean;
  lowBalance: boolean;
  lowBalanceWindowDays: number;
  largeBills: boolean;
  largeBillThreshold: number;
  upcomingWindowDays: number;
  missedIncome: boolean;
  missedIncomeGraceDays: number;
};

export type AlertItem = {
  id: string;
  title: string;
  description: string;
  tone: "info" | "warning" | "critical" | "good";
  href?: string;
};

export const DEFAULT_ALERT_PREFS: AlertPreferences = {
  enabled: true,
  lowBalance: true,
  lowBalanceWindowDays: 30,
  largeBills: true,
  largeBillThreshold: 200,
  upcomingWindowDays: 14,
  missedIncome: true,
  missedIncomeGraceDays: 2,
};

function scopedKey(base: string, scope = getStorageScope()) {
  return scope === "default" ? base : `${base}::${scope}`;
}

function prefsKey() {
  return scopedKey(ALERT_PREFS_KEY);
}

function dispatchBrowserEvent(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

function toUtcDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function addDaysISO(iso: string, days: number) {
  const date = new Date(toUtcDay(iso));
  date.setUTCDate(date.getUTCDate() + days);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayDiff(a: string, b: string) {
  return Math.round((toUtcDay(b) - toUtcDay(a)) / (1000 * 60 * 60 * 24));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value || 0);
}

function matchesIncomeEvent(event: CashflowEvent, txn: Transaction, graceDays: number) {
  if (txn.type !== "income") return false;
  if (event.sourceId && txn.linkedRuleId && txn.linkedRuleId === event.sourceId) return true;
  const daysApart = Math.abs(dayDiff(event.date, txn.date));
  if (daysApart > graceDays) return false;
  const label = normalizeText(event.label);
  const txnLabel = normalizeText(txn.label || "");
  const txnNotes = normalizeText(txn.notes ?? "");
  const labelMatch = label.length > 0 && (txnLabel.includes(label) || txnNotes.includes(label));
  const amountMatch = Math.abs(txn.amount - event.amount) < 0.01;
  return labelMatch || amountMatch;
}

export function loadAlertPreferences(): AlertPreferences {
  if (typeof window === "undefined") return DEFAULT_ALERT_PREFS;
  const raw = window.localStorage.getItem(prefsKey());
  if (!raw) return DEFAULT_ALERT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<AlertPreferences>;
    return { ...DEFAULT_ALERT_PREFS, ...parsed };
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
}

export function saveAlertPreferences(prefs: AlertPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(prefsKey(), JSON.stringify(prefs));
  dispatchBrowserEvent(ALERT_PREFS_UPDATED_EVENT);
  touchPreferencesUpdatedAt();
}

export function updateAlertPreferences(patch: Partial<AlertPreferences>) {
  const current = loadAlertPreferences();
  const next = { ...current, ...patch };
  saveAlertPreferences(next);
  return next;
}

export function getAlerts(plan: Plan, periodId: number, prefs: AlertPreferences): AlertItem[] {
  if (!prefs.enabled) return [];

  const period = getPeriod(plan, periodId);
  const alerts: AlertItem[] = [];
  const asOfDate = plan.setup.asOfDate;

  if (prefs.lowBalance) {
    const lookaheadDays =
      prefs.lowBalanceWindowDays > 0 ? prefs.lowBalanceWindowDays : dayDiff(asOfDate, period.end);
    const lookaheadEnd = addDaysISO(asOfDate, lookaheadDays);
    const startingBalance = getStartingBalance(plan, periodId);
    const timeline = buildTimeline(plan, periodId, startingBalance);
    const riskRows = timeline.filter(
      (row) =>
        row.date >= asOfDate &&
        row.date <= lookaheadEnd &&
        row.balance < plan.setup.expectedMinBalance
    );
    if (riskRows.length) {
      const first = riskRows[0];
      alerts.push({
        id: "low-balance",
        title: "Low balance risk",
        description: `${riskRows.length} day(s) fall below ${formatCurrency(
          plan.setup.expectedMinBalance
        )}, first on ${first.date}.`,
        tone: "warning",
        href: "/timeline",
      });
    }
  }

  if (prefs.largeBills) {
    const windowEnd = addDaysISO(asOfDate, Math.max(0, prefs.upcomingWindowDays));
    const upcoming = generateEvents(plan, periodId)
      .filter(
        (event) =>
          event.type === "outflow" &&
          event.category === "bill" &&
          event.date >= asOfDate &&
          event.date <= windowEnd &&
          event.amount >= prefs.largeBillThreshold
      )
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    if (upcoming.length) {
      const list = upcoming.map((event) => `${event.label} ${formatCurrency(event.amount)}`);
      alerts.push({
        id: "large-bills",
        title: "Upcoming large bills",
        description: `Next ${prefs.upcomingWindowDays} days: ${list.join(", ")}.`,
        tone: "info",
        href: "/bills",
      });
    }
  }

  if (prefs.missedIncome) {
    const graceDays = Math.max(0, prefs.missedIncomeGraceDays);
    const latestExpected = addDaysISO(asOfDate, -graceDays);
    const incomeEvents = generateEvents(plan, periodId).filter(
      (event) => event.type === "income" && event.date <= latestExpected
    );
    const incomeTxns = plan.transactions.filter((txn) => txn.type === "income");
    const missed = incomeEvents.filter(
      (event) => !incomeTxns.some((txn) => matchesIncomeEvent(event, txn, graceDays))
    );
    if (missed.length) {
      const labels = Array.from(new Set(missed.map((event) => event.label))).slice(0, 3);
      const suffix = missed.length > labels.length ? ` (+${missed.length - labels.length} more)` : "";
      alerts.push({
        id: "missed-income",
        title: "Possible missed income",
        description: `${missed.length} income(s) look unpaid: ${labels.join(", ")}${suffix}.`,
        tone: "warning",
        href: "/income",
      });
    }
  }

  if (!alerts.length) {
    alerts.push({
      id: "all-clear",
      title: "All clear",
      description: "No alerts triggered for this period window.",
      tone: "good",
    });
  }

  return alerts;
}
