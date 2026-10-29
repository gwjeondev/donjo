import Link from "next/link";
import { tone } from "@/lib/format";

export interface RankItem {
  href: string;
  name: string;
  /** 오른쪽 큰 값 (색은 t의 부호) */
  value: string;
  sub?: string;
  t: number;
}

/** 순위 카드: 제목 아래에 묶음(상승/하락 등)마다 종목 줄을 보여 준다 */
export function RankCard({ title, columns }: { title: string; columns: { label: string; items: RankItem[] }[] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {columns.map((col) => (
          <div key={col.label} className="min-w-0">
            <p className="mb-1 text-xs text-muted">{col.label}</p>
            {col.items.length === 0 ? (
              <p className="py-2 text-sm text-muted">없어요</p>
            ) : (
              <ul className="divide-y divide-line">
                {col.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="flex items-center justify-between gap-3 py-2 hover:text-brand">
                      <span className="min-w-0 truncate text-sm" title={it.name}>
                        {it.name}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className={`block text-sm font-medium ${tone(it.t)}`}>{it.value}</span>
                        {it.sub && <span className={`block text-xs ${tone(it.t)}`}>{it.sub}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
