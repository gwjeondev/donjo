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
    desc: "켠 뒤에 새로 기록한 매수·매도·배당부터 현금에 반영해요. 이미 있는 기록은 현금을 바꾸지 않아요. 국내 주식은 원화, 미국 주식은 달러로만 사고팔아요. 달러는 입금이나 환전으로 직접 넣어 주세요.",
  },
] as const;

const fmtSince = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

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
            {o.value === "linked" && mode === "linked" && initial.cash === "linked" && initial.cashSince && (
              <span className="mt-1 block text-xs text-muted" suppressHydrationWarning /* 서버와 브라우저의 시간대가 달라도 브라우저 시각으로 */>
                {fmtSince(initial.cashSince)}부터 연동 중
              </span>
            )}
          </span>
        </label>
      ))}
      <p className="h-4 text-xs text-muted" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
