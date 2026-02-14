"use client";

import { touchPreferencesUpdatedAt } from "@/lib/preferencesSync";
import { getStorageScope } from "@/lib/storage";

export type Currency = "GBP" | "USD" | "EUR" | "JPY" | "CAD" | "AUD" | "CHF" | "CNY" | "INR" | "GHS" | "NGN"
  | "ZAR" | "KES" | "BRL" | "MXN" | "SEK" | "NOK" | "DKK" | "PLN" | "NZD" | "SGD" | "HKD" | "KRW"
  | "TRY" | "AED" | "SAR" | "PHP" | "THB" | "MYR" | "IDR" | "COP" | "ARS" | "CLP" | "PEN" | "EGP"
  | "PKR" | "BDT" | "VND" | "TWD" | "ILS" | "CZK" | "HUF" | "RON" | "BGN" | "HRK" | "UAH" | "RUB";

const CURRENCY_KEY = "velanovo-currency";

function currencyKey() {
  const scope = getStorageScope();
  return scope === "default" ? CURRENCY_KEY : `${CURRENCY_KEY}::${scope}`;
}

export type CurrencyInfo = { symbol: string; name: string; locale: string };

export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  // Americas
  USD: { symbol: "$", name: "US Dollar", locale: "en-US" },
  CAD: { symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  BRL: { symbol: "R$", name: "Brazilian Real", locale: "pt-BR" },
  MXN: { symbol: "MX$", name: "Mexican Peso", locale: "es-MX" },
  ARS: { symbol: "AR$", name: "Argentine Peso", locale: "es-AR" },
  CLP: { symbol: "CL$", name: "Chilean Peso", locale: "es-CL" },
  COP: { symbol: "CO$", name: "Colombian Peso", locale: "es-CO" },
  PEN: { symbol: "S/.", name: "Peruvian Sol", locale: "es-PE" },
  // Europe
  GBP: { symbol: "£", name: "British Pound", locale: "en-GB" },
  EUR: { symbol: "€", name: "Euro", locale: "de-DE" },
  CHF: { symbol: "CHF", name: "Swiss Franc", locale: "de-CH" },
  SEK: { symbol: "kr", name: "Swedish Krona", locale: "sv-SE" },
  NOK: { symbol: "kr", name: "Norwegian Krone", locale: "nb-NO" },
  DKK: { symbol: "kr", name: "Danish Krone", locale: "da-DK" },
  PLN: { symbol: "zł", name: "Polish Zloty", locale: "pl-PL" },
  CZK: { symbol: "Kč", name: "Czech Koruna", locale: "cs-CZ" },
  HUF: { symbol: "Ft", name: "Hungarian Forint", locale: "hu-HU" },
  RON: { symbol: "lei", name: "Romanian Leu", locale: "ro-RO" },
  BGN: { symbol: "лв", name: "Bulgarian Lev", locale: "bg-BG" },
  HRK: { symbol: "kn", name: "Croatian Kuna", locale: "hr-HR" },
  UAH: { symbol: "₴", name: "Ukrainian Hryvnia", locale: "uk-UA" },
  RUB: { symbol: "₽", name: "Russian Ruble", locale: "ru-RU" },
  TRY: { symbol: "₺", name: "Turkish Lira", locale: "tr-TR" },
  ILS: { symbol: "₪", name: "Israeli Shekel", locale: "he-IL" },
  // Asia-Pacific
  JPY: { symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  CNY: { symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  INR: { symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  KRW: { symbol: "₩", name: "South Korean Won", locale: "ko-KR" },
  SGD: { symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  HKD: { symbol: "HK$", name: "Hong Kong Dollar", locale: "en-HK" },
  TWD: { symbol: "NT$", name: "Taiwan Dollar", locale: "zh-TW" },
  AUD: { symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  NZD: { symbol: "NZ$", name: "New Zealand Dollar", locale: "en-NZ" },
  PHP: { symbol: "₱", name: "Philippine Peso", locale: "en-PH" },
  THB: { symbol: "฿", name: "Thai Baht", locale: "th-TH" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit", locale: "ms-MY" },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID" },
  VND: { symbol: "₫", name: "Vietnamese Dong", locale: "vi-VN" },
  PKR: { symbol: "₨", name: "Pakistani Rupee", locale: "en-PK" },
  BDT: { symbol: "৳", name: "Bangladeshi Taka", locale: "bn-BD" },
  // Middle East & Africa
  AED: { symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE" },
  SAR: { symbol: "﷼", name: "Saudi Riyal", locale: "ar-SA" },
  EGP: { symbol: "E£", name: "Egyptian Pound", locale: "ar-EG" },
  ZAR: { symbol: "R", name: "South African Rand", locale: "en-ZA" },
  KES: { symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE" },
  GHS: { symbol: "GH₵", name: "Ghanaian Cedi", locale: "en-GH" },
  NGN: { symbol: "₦", name: "Nigerian Naira", locale: "en-NG" },
};

/** Map of country codes to their primary currencies */
export type CountryCode = string;
export type CountryInfo = { name: string; flag: string; currency: Currency };

export const COUNTRIES: Record<CountryCode, CountryInfo> = {
  // Americas
  US: { name: "United States", flag: "🇺🇸", currency: "USD" },
  CA: { name: "Canada", flag: "🇨🇦", currency: "CAD" },
  BR: { name: "Brazil", flag: "🇧🇷", currency: "BRL" },
  MX: { name: "Mexico", flag: "🇲🇽", currency: "MXN" },
  AR: { name: "Argentina", flag: "🇦🇷", currency: "ARS" },
  CL: { name: "Chile", flag: "🇨🇱", currency: "CLP" },
  CO: { name: "Colombia", flag: "🇨🇴", currency: "COP" },
  PE: { name: "Peru", flag: "🇵🇪", currency: "PEN" },
  // Europe
  GB: { name: "United Kingdom", flag: "🇬🇧", currency: "GBP" },
  DE: { name: "Germany", flag: "🇩🇪", currency: "EUR" },
  FR: { name: "France", flag: "🇫🇷", currency: "EUR" },
  IT: { name: "Italy", flag: "🇮🇹", currency: "EUR" },
  ES: { name: "Spain", flag: "🇪🇸", currency: "EUR" },
  NL: { name: "Netherlands", flag: "🇳🇱", currency: "EUR" },
  BE: { name: "Belgium", flag: "🇧🇪", currency: "EUR" },
  AT: { name: "Austria", flag: "🇦🇹", currency: "EUR" },
  IE: { name: "Ireland", flag: "🇮🇪", currency: "EUR" },
  PT: { name: "Portugal", flag: "🇵🇹", currency: "EUR" },
  FI: { name: "Finland", flag: "🇫🇮", currency: "EUR" },
  GR: { name: "Greece", flag: "🇬🇷", currency: "EUR" },
  CH: { name: "Switzerland", flag: "🇨🇭", currency: "CHF" },
  SE: { name: "Sweden", flag: "🇸🇪", currency: "SEK" },
  NO: { name: "Norway", flag: "🇳🇴", currency: "NOK" },
  DK: { name: "Denmark", flag: "🇩🇰", currency: "DKK" },
  PL: { name: "Poland", flag: "🇵🇱", currency: "PLN" },
  CZ: { name: "Czech Republic", flag: "🇨🇿", currency: "CZK" },
  HU: { name: "Hungary", flag: "🇭🇺", currency: "HUF" },
  RO: { name: "Romania", flag: "🇷🇴", currency: "RON" },
  BG: { name: "Bulgaria", flag: "🇧🇬", currency: "BGN" },
  HR: { name: "Croatia", flag: "🇭🇷", currency: "HRK" },
  UA: { name: "Ukraine", flag: "🇺🇦", currency: "UAH" },
  RU: { name: "Russia", flag: "🇷🇺", currency: "RUB" },
  TR: { name: "Turkey", flag: "🇹🇷", currency: "TRY" },
  IL: { name: "Israel", flag: "🇮🇱", currency: "ILS" },
  // Asia-Pacific
  JP: { name: "Japan", flag: "🇯🇵", currency: "JPY" },
  CN: { name: "China", flag: "🇨🇳", currency: "CNY" },
  IN: { name: "India", flag: "🇮🇳", currency: "INR" },
  KR: { name: "South Korea", flag: "🇰🇷", currency: "KRW" },
  SG: { name: "Singapore", flag: "🇸🇬", currency: "SGD" },
  HK: { name: "Hong Kong", flag: "🇭🇰", currency: "HKD" },
  TW: { name: "Taiwan", flag: "🇹🇼", currency: "TWD" },
  AU: { name: "Australia", flag: "🇦🇺", currency: "AUD" },
  NZ: { name: "New Zealand", flag: "🇳🇿", currency: "NZD" },
  PH: { name: "Philippines", flag: "🇵🇭", currency: "PHP" },
  TH: { name: "Thailand", flag: "🇹🇭", currency: "THB" },
  MY: { name: "Malaysia", flag: "🇲🇾", currency: "MYR" },
  ID: { name: "Indonesia", flag: "🇮🇩", currency: "IDR" },
  VN: { name: "Vietnam", flag: "🇻🇳", currency: "VND" },
  PK: { name: "Pakistan", flag: "🇵🇰", currency: "PKR" },
  BD: { name: "Bangladesh", flag: "🇧🇩", currency: "BDT" },
  // Middle East & Africa
  AE: { name: "United Arab Emirates", flag: "🇦🇪", currency: "AED" },
  SA: { name: "Saudi Arabia", flag: "🇸🇦", currency: "SAR" },
  EG: { name: "Egypt", flag: "🇪🇬", currency: "EGP" },
  ZA: { name: "South Africa", flag: "🇿🇦", currency: "ZAR" },
  KE: { name: "Kenya", flag: "🇰🇪", currency: "KES" },
  GH: { name: "Ghana", flag: "🇬🇭", currency: "GHS" },
  NG: { name: "Nigeria", flag: "🇳🇬", currency: "NGN" },
};

const COUNTRY_KEY = "velanovo-country";

function countryKey() {
  const scope = getStorageScope();
  return scope === "default" ? COUNTRY_KEY : `${COUNTRY_KEY}::${scope}`;
}

/** Detect the user's country code from their browser locale */
function detectCountryFromLocale(): CountryCode | null {
  if (typeof navigator === "undefined") return null;
  // navigator.language gives e.g. "en-US", "fr-FR", "en-GH"
  const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || "";
  const parts = lang.split("-");
  if (parts.length >= 2) {
    const country = parts[parts.length - 1].toUpperCase();
    if (country in COUNTRIES) return country;
  }
  // Fallback: check navigator.languages for a more specific locale
  const languages = navigator.languages || [];
  for (const l of languages) {
    const p = l.split("-");
    if (p.length >= 2) {
      const c = p[p.length - 1].toUpperCase();
      if (c in COUNTRIES) return c;
    }
  }
  return null;
}

/** Detect the currency from the user's browser locale */
function detectCurrencyFromLocale(): Currency {
  const country = detectCountryFromLocale();
  if (country && country in COUNTRIES) {
    return COUNTRIES[country].currency;
  }
  return "USD"; // sensible global default
}

export function getCountry(): CountryCode {
  if (typeof window === "undefined") return "US";
  const stored = localStorage.getItem(countryKey());
  if (stored && stored in COUNTRIES) return stored;
  // Auto-detect on first use
  const detected = detectCountryFromLocale();
  return detected ?? "US";
}

export function setCountry(country: CountryCode) {
  localStorage.setItem(countryKey(), country);
  // Also update currency to match
  const info = COUNTRIES[country];
  if (info) setCurrency(info.currency);
  touchPreferencesUpdatedAt();
}

export function getCurrency(): Currency {
  if (typeof window === "undefined") return "USD";

  const stored = localStorage.getItem(currencyKey()) || localStorage.getItem(CURRENCY_KEY);
  if (stored && stored in CURRENCIES) return stored as Currency;

  // No stored preference — auto-detect from browser locale
  return detectCurrencyFromLocale();
}

export function setCurrency(currency: Currency) {
  localStorage.setItem(currencyKey(), currency);
  touchPreferencesUpdatedAt();
}

export function formatMoney(amount: number, currency?: Currency): string {
  const curr = currency || getCurrency();
  const config = CURRENCIES[curr];
  const zeroDecimal: Currency[] = ["JPY", "KRW", "VND", "CLP", "HUF", "IDR"];

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: curr,
    maximumFractionDigits: zeroDecimal.includes(curr) ? 0 : 2,
  }).format(amount || 0);
}
