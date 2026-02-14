"use client";

import { useEffect, useState } from "react";
import {
  getCurrency,
  setCurrency,
  getCountry,
  setCountry,
  CURRENCIES,
  COUNTRIES,
  type Currency,
  type CountryCode,
} from "@/lib/currency";
import { showToast } from "./Toast";

/** Group countries by region for easier scanning */
const REGIONS: { label: string; codes: CountryCode[] }[] = [
  {
    label: "Americas",
    codes: ["US", "CA", "MX", "BR", "AR", "CL", "CO", "PE"],
  },
  {
    label: "Europe",
    codes: [
      "GB", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "FI", "GR",
      "CH", "SE", "NO", "DK", "PL", "CZ", "HU", "RO", "BG", "HR", "UA", "RU", "TR", "IL",
    ],
  },
  {
    label: "Asia & Pacific",
    codes: ["JP", "CN", "IN", "KR", "SG", "HK", "TW", "AU", "NZ", "PH", "TH", "MY", "ID", "VN", "PK", "BD"],
  },
  {
    label: "Middle East & Africa",
    codes: ["AE", "SA", "EG", "ZA", "KE", "GH", "NG"],
  },
];

export default function CurrencySelector() {
  const [country, setCountryState] = useState<CountryCode>("US");
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCountryState(getCountry());
    setCurrencyState(getCurrency());
  }, []);

  const handleCountryChange = (newCountry: CountryCode) => {
    const info = COUNTRIES[newCountry];
    if (!info) return;
    setCountryState(newCountry);
    setCountry(newCountry); // also sets currency
    setCurrencyState(info.currency);
    showToast(
      `${info.flag} ${info.name} — ${CURRENCIES[info.currency].symbol} ${CURRENCIES[info.currency].name}`,
      "success"
    );
    setTimeout(() => window.location.reload(), 600);
  };

  const handleCurrencyOverride = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    setCurrencyState(newCurrency);
    showToast(`Currency changed to ${CURRENCIES[newCurrency].symbol} ${CURRENCIES[newCurrency].name}`, "success");
    setTimeout(() => window.location.reload(), 600);
  };

  if (!mounted) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-700" />
        <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-700" />
      </div>
    );
  }

  const countryInfo = COUNTRIES[country];
  const currencyInfo = CURRENCIES[currency];

  return (
    <div className="space-y-5">
      {/* Country selector */}
      <div className="space-y-2">
        <label
          htmlFor="country-select"
          className="text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          Country
        </label>
        <select
          id="country-select"
          name="country"
          value={country}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--accent)] transition-colors"
        >
          {REGIONS.map((region) => (
            <optgroup key={region.label} label={region.label}>
              {region.codes.map((code) => {
                const c = COUNTRIES[code];
                return (
                  <option key={code} value={code}>
                    {c.flag} {c.name}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Sets your default currency automatically
        </p>
      </div>

      {/* Currency display + override */}
      <div className="space-y-2">
        <label
          htmlFor="currency-select"
          className="text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          Currency
        </label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm flex-1">
            <span className="text-lg">{countryInfo?.flag}</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {currencyInfo?.symbol}
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {currencyInfo?.name} ({currency})
            </span>
          </div>
        </div>
        <details className="text-xs">
          <summary className="text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            Use a different currency for {countryInfo?.name ?? "your country"}
          </summary>
          <select
            id="currency-select"
            name="currency"
            value={currency}
            onChange={(e) => handleCurrencyOverride(e.target.value as Currency)}
            className="mt-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[var(--accent)]"
          >
            {(Object.keys(CURRENCIES) as Currency[]).map((curr) => (
              <option key={curr} value={curr}>
                {CURRENCIES[curr].symbol} {CURRENCIES[curr].name} ({curr})
              </option>
            ))}
          </select>
        </details>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Page will reload after changing country or currency
      </p>
    </div>
  );
}
