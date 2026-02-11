"use client";

import { touchPreferencesUpdatedAt } from "@/lib/preferencesSync";
import { getStorageScope } from "@/lib/storage";

export type Currency = "GBP" | "USD" | "EUR" | "JPY" | "CAD" | "AUD" | "CHF" | "CNY" | "INR" | "GHS" | "NGN";

const CURRENCY_KEY = "velanovo-currency";

function currencyKey() {
  const scope = getStorageScope();
  return scope === "default" ? CURRENCY_KEY : `${CURRENCY_KEY}::${scope}`;
}

export const CURRENCIES: Record<Currency, { symbol: string; name: string; locale: string }> = {
  GBP: { symbol: "£", name: "British Pound", locale: "en-GB" },
  USD: { symbol: "$", name: "US Dollar", locale: "en-US" },
  EUR: { symbol: "€", name: "Euro", locale: "de-DE" },
  JPY: { symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  CAD: { symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  AUD: { symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  CHF: { symbol: "CHF", name: "Swiss Franc", locale: "de-CH" },
  CNY: { symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  INR: { symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  GHS: { symbol: "₵", name: "Ghanaian Cedi", locale: "en-GH" },
  NGN: { symbol: "₦", name: "Nigerian Naira", locale: "en-NG" },
};

export function getCurrency(): Currency {
  if (typeof window === "undefined") return "GBP";

  const stored = localStorage.getItem(currencyKey()) || localStorage.getItem(CURRENCY_KEY);
  if (stored && stored in CURRENCIES) return stored as Currency;

  return "GBP";
}

export function setCurrency(currency: Currency) {
  localStorage.setItem(currencyKey(), currency);
  touchPreferencesUpdatedAt();
}

export function formatMoney(amount: number, currency?: Currency): string {
  const curr = currency || getCurrency();
  const config = CURRENCIES[curr];

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: curr,
    maximumFractionDigits: curr === "JPY" ? 0 : 2,
  }).format(amount || 0);
}
