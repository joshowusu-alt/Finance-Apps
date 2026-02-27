import type { BillTemplate } from "@/data/plan";
import type { CountryCode } from "@/lib/currency";

export const DEFAULT_BILLS: BillTemplate[] = [
  { id: "rent", label: "Rent / Mortgage", amount: 950, dueDay: 1, category: "bill", enabled: true },
  { id: "utilities", label: "Utilities", amount: 85, dueDay: 12, category: "bill", enabled: true },
  { id: "phone", label: "Phone", amount: 25, dueDay: 18, category: "bill", enabled: true },
  { id: "internet", label: "Internet", amount: 35, dueDay: 15, category: "bill", enabled: true },
];

export const POPULAR_COUNTRIES: CountryCode[] = [
  "US", "GB", "CA", "AU", "IN", "DE", "NG", "GH", "ZA", "FR", "NZ", "KE",
];
