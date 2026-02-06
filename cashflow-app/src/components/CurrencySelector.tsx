"use client";

import { useEffect, useState } from "react";
import { getCurrency, setCurrency, CURRENCIES, type Currency } from "@/lib/currency";
import { showToast } from "./Toast";

export default function CurrencySelector() {
  const [currency, setCurrencyState] = useState<Currency>("GBP");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrencyState(getCurrency());
  }, []);

  const handleChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    setCurrencyState(newCurrency);
    showToast(`Currency changed to ${CURRENCIES[newCurrency].name}`, "success");
    // Reload page to update all currency displays
    setTimeout(() => window.location.reload(), 500);
  };

  if (!mounted) {
    return (
      <select
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        disabled
      >
        <option>Loading...</option>
      </select>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        Currency
      </label>
      <select
        value={currency}
        onChange={(e) => handleChange(e.target.value as Currency)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--accent)]"
      >
        {(Object.keys(CURRENCIES) as Currency[]).map((curr) => (
          <option key={curr} value={curr}>
            {CURRENCIES[curr].symbol} {CURRENCIES[curr].name} ({curr})
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Page will reload after changing currency
      </p>
    </div>
  );
}
