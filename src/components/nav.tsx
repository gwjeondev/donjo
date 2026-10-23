"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartIcon, HomeIcon, ListIcon, WalletIcon } from "./icons";

const ITEMS = [
  { href: "/dashboard", label: "대시보드", Icon: HomeIcon },
  { href: "/accounts", label: "계좌", Icon: WalletIcon },
  { href: "/transactions", label: "매매기록", Icon: ListIcon },
  { href: "/performance", label: "수익률", Icon: ChartIcon },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = path.startsWith(href) || (href === "/dashboard" && path.startsWith("/stocks/"));
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-brand/10 text-brand" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-4">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = path.startsWith(href) || (href === "/dashboard" && path.startsWith("/stocks/"));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand" : "text-muted"}`}
            >
              <Icon className="size-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
