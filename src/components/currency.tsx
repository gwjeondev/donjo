"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { DisplayCurrency } from "@/lib/portfolio";

// 종목별 금액(보유 종목, 매매 기록)의 해외 종목 표시 통화. 합계 카드는 항상 원화.
const KEY = "donjo-currency";
const Ctx = createContext<{ currency: DisplayCurrency; setCurrency: (c: DisplayCurrency) => void }>({
  currency: "KRW",
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setState] = useState<DisplayCurrency>("KRW");
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "USD") setState("USD");
    } catch {
      /* 저장소 사용 불가: 기본값(원화) */
    }
  }, []);
  const setCurrency = (c: DisplayCurrency) => {
    setState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* 이번 화면에만 적용 */
    }
  };
  return <Ctx.Provider value={{ currency, setCurrency }}>{children}</Ctx.Provider>;
}

export const useDisplayCurrency = () => useContext(Ctx);

/** 해외 종목 금액 표시 통화 전환 (₩ 원화 / $ 달러) */
export function CurrencyToggle() {
  const { currency, setCurrency } = useDisplayCurrency();
  return (
    <div role="radiogroup" aria-label="해외 종목 표시 통화" title="해외 종목 표시 통화" className="ml-auto flex shrink-0 rounded-lg bg-surface-2 p-0.5 text-xs" /* 어느 화면이든 오른쪽 (줄이 바뀌어도) */>
      {(["KRW", "USD"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={currency === c}
          onClick={() => setCurrency(c)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition ${
            currency === c ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
          }`}
        >
          {c === "KRW" ? "₩ 원화" : "$ 달러"}
        </button>
      ))}
    </div>
  );
}
