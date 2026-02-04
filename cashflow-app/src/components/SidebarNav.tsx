"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarNavProps = {
  periodLabel?: string;
  periodStart?: string;
  periodEnd?: string;
};

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/timeline", label: "Timeline" },
  { href: "/insights", label: "Insights" },
  { href: "/transactions", label: "Transactions" },
  { href: "/bills", label: "Bills" },
  { href: "/income", label: "Income" },
  { href: "/settings", label: "Settings" },
];

export default function SidebarNav({ periodLabel, periodStart, periodEnd }: SidebarNavProps) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <aside className="hidden lg:flex flex-col gap-6 rounded-3xl bg-[var(--panel)] p-6 text-slate-100 shadow-xl">
      <div className="flex items-center">
        <Image src="/logo-wordmark.svg" alt="Vero logo" width={140} height={32} className="h-8 w-auto" priority />
      </div>
      <nav className="space-y-2 text-sm">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2 transition",
                active ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl bg-white/5 p-4 text-xs text-slate-200">
        {periodLabel ? periodLabel : "Period"}
        {periodStart && periodEnd ? (
          <div className="mt-1 text-[11px] text-slate-400">
            {periodStart} to {periodEnd}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
