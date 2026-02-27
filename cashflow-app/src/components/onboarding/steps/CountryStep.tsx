"use client";

import { COUNTRIES, CURRENCIES, type CountryCode } from "@/lib/currency";
import { POPULAR_COUNTRIES } from "@/data/onboardingData";

export interface CountryStepProps {
  country: CountryCode;
  onSelect: (code: CountryCode) => void;
  showAllCountries: boolean;
  onShowAll: () => void;
}

export function CountryStep({ country, onSelect, showAllCountries, onShowAll }: CountryStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-(--vn-text)">Where are you based?</h2>
        <p className="mt-2 text-sm text-(--vn-muted)">This sets your currency and number format automatically.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {POPULAR_COUNTRIES.map((code) => {
          const c = COUNTRIES[code];
          return (
            <button
              key={code}
              onClick={() => onSelect(code)}
              className={`rounded-xl px-3 py-3 text-left transition-all border-2 ${
                country === code
                  ? "border-(--vn-primary) bg-(--vn-primary)/10"
                  : "border-(--vn-border) hover:border-(--vn-primary)/50"
              }`}
            >
              <span className="text-xl">{c.flag}</span>
              <div className="text-xs font-medium text-(--vn-text) mt-1 truncate">{c.name}</div>
              <div className="text-[10px] text-(--vn-muted)">{CURRENCIES[c.currency].symbol} {c.currency}</div>
            </button>
          );
        })}
      </div>

      {!showAllCountries ? (
        <button
          onClick={onShowAll}
          className="text-xs text-(--vn-primary) hover:underline"
        >
          Show all countries
        </button>
      ) : (
        <select
          value={country}
          onChange={(e) => onSelect(e.target.value as CountryCode)}
          className="w-full rounded-lg border border-(--vn-border) bg-(--vn-surface) px-3 py-2 text-sm text-(--vn-text) focus:outline-none focus:border-(--vn-primary)"
        >
          {Object.entries(COUNTRIES).map(([code, c]) => (
            <option key={code} value={code}>
              {c.flag} {c.name} ({CURRENCIES[c.currency].symbol} {c.currency})
            </option>
          ))}
        </select>
      )}

      {country in COUNTRIES && (
        <div className="flex items-center gap-2 rounded-lg bg-(--vn-primary)/5 px-3 py-2 text-sm">
          <span className="text-lg">{COUNTRIES[country].flag}</span>
          <span className="font-medium text-(--vn-text)">
            {CURRENCIES[COUNTRIES[country].currency].symbol} {CURRENCIES[COUNTRIES[country].currency].name}
          </span>
        </div>
      )}
    </div>
  );
}
