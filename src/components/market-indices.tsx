import { fmtPct, tone } from "@/lib/format";
import type { IndexMove } from "@/lib/market/service";

const price = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 금리 변동 (%p → bp): +3.2bp */
const bp = (d: number) => `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}bp`;

/** 주가지수·달러 지수·미 국채 금리·원자재: 값과 전날·지금 변동 */
export function MarketIndices({ items }: { items: IndexMove[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((m, i) => (
        <div key={m.label} className={`card min-w-0 p-4 ${i === items.length - 1 && items.length % 2 ? "col-span-2 sm:col-span-1" : ""}`}>
          <p className="text-xs text-ink-2">{m.label}</p>
          <p className="mt-1 text-xl font-bold">{m.kind === "yield" ? `${m.price.toFixed(3)}%` : `${m.prefix ?? ""}${price.format(m.price)}`}</p>
          <dl className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
            {(
              [
                ["전날", m.prev],
                ["지금", m.now],
              ] as const
            ).map(([label, r]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className={`font-medium ${r == null ? "text-muted" : tone(r)}`}>{r == null ? "-" : m.kind === "yield" ? bp(r) : fmtPct(r)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
