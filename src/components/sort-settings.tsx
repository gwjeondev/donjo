"use client";

import { useState, useTransition } from "react";
import { savePrefs } from "@/app/actions";
import { ACCOUNT_SORTS, HOLDING_SORTS, type Prefs } from "@/lib/prefs";
import { SortControl } from "./sort-control";

/** 설정 화면: 목록마다 기본 정렬. 바꾸면 바로 저장한다 */
export function SortSettings({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  const update = (next: Prefs) => {
    setPrefs(next);
    setStatus("saving");
    startTransition(async () => {
      const r = await savePrefs(next).catch(() => ({ error: "x" }));
      setStatus("error" in r && r.error ? "error" : "saved");
    });
  };

  const row = (label: string, control: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <span className="text-sm text-ink-2">{label}</span>
      {control}
    </div>
  );

  return (
    <div className="space-y-3">
      {row("계좌 목록", <SortControl label="계좌 목록 정렬" options={ACCOUNT_SORTS} value={prefs.accounts} onChange={(accounts) => update({ ...prefs, accounts })} />)}
      {row(
        "보유 종목 (대시보드·계좌)",
        <SortControl label="보유 종목 정렬" options={HOLDING_SORTS} value={prefs.holdings} onChange={(holdings) => update({ ...prefs, holdings })} />,
      )}
      {row(
        "매매 기록",
        <div role="radiogroup" aria-label="매매 기록 정렬" className="flex rounded-lg bg-surface-2 p-0.5 text-sm">
          {(["new", "old"] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={prefs.trades === o}
              onClick={() => update({ ...prefs, trades: o })}
              className={`rounded-md px-3 py-1.5 font-medium ${prefs.trades === o ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
            >
              {o === "new" ? "최신순" : "오래된순"}
            </button>
          ))}
        </div>,
      )}
      <p className="h-4 text-xs text-muted" aria-live="polite">
        {status === "saving" ? "저장 중…" : status === "saved" ? "저장했어요" : status === "error" ? "저장하지 못했어요. 다시 시도해 주세요." : ""}
      </p>
    </div>
  );
}
