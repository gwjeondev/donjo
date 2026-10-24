import Link from "next/link";
import { ChevronRightIcon } from "./icons";

/** 상세 화면 아래 '더 보기' 바로가기 카드 (거래내역·수익률·손익 화면을 걸러서 연다) */
export function LinkCards({ label, links }: { label: string; links: { href: string; label: string; desc: string }[] }) {
  return (
    <nav className={`grid grid-cols-1 gap-3 ${links.length >= 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`} aria-label={label}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="card flex items-center justify-between gap-3 px-5 py-4 transition hover:border-brand/50">
          <span className="min-w-0">
            <span className="block font-semibold">{l.label}</span>
            <span className="block truncate text-xs text-muted">{l.desc}</span>
          </span>
          <ChevronRightIcon className="size-5 shrink-0 text-muted" />
        </Link>
      ))}
    </nav>
  );
}
