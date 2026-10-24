"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePrefs } from "@/app/actions";
import type { Prefs } from "@/lib/prefs";

const OPTIONS = [
  { value: "manual", label: "따로 관리", desc: "입금·출금·환전으로 넣은 금액만 현금으로 봐요. 현금을 0으로 두고 주식만 기록할 때 좋아요." },
  {
    value: "linked",
    label: "매매와 연동",
    desc: "매수하면 현금이 줄고, 매도·배당이 들어오면 늘어요. 미국 주식은 달러가 있으면 달러에서, 모자라면 그날 환율로 원화에서 빠져요.",
  },
] as const;

/** 설정: 현금 잔고를 매매와 연동할지 */
export function CashModeSetting({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [mode, setMode] = useState(initial.cash);
  const [status, setStatus] = useState("");
  const [, start] = useTransition();
  return (
    <div className="space-y-2" role="radiogroup" aria-label="현금 관리 방식">
      {OPTIONS.map((o) => (
        <label key={o.value} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${mode === o.value ? "border-brand bg-brand/5" : "border-line"}`}>
          <input
            type="radio"
            name="cash-mode"
            className="mt-0.5 size-4 accent-brand"
            checked={mode === o.value}
            onChange={() => {
              setMode(o.value);
              setStatus("저장 중…");
              start(async () => {
                const r = await savePrefs({ cash: o.value }).catch(() => ({ error: "x" }));
                setStatus("error" in r && r.error ? "저장하지 못했어요" : "저장했어요");
                router.refresh();
              });
            }}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-2" data-wrap="ok">
              {o.desc}
            </span>
          </span>
        </label>
      ))}
      <p className="h-4 text-xs text-muted" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
