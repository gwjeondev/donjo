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
      const r = await savePrefs({ accounts: next.accounts, holdings: next.holdings, trades: next.trades }).catch(() => ({ error: "x" }));
      setStatus("error" in r && r.error ? "error" : "saved");
    });
  };

  // 오른쪽 조작부는 모두 같은 폭이라 줄마다 왼쪽·오른쪽 끝이 맞는다
  const W = "w-40 sm:w-60";
  const row = (label: string, control: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <span className="min-w-0 text-sm text-ink-2">{label}</span>
      {/* 좁아서 다음 줄로 내려가도 오른쪽에 */}
      <div className="ml-auto">{control}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {row("계좌 목록", <SortControl fill className={W} label="계좌 목록 정렬" options={ACCOUNT_SORTS} value={prefs.accounts} onChange={(accounts) => update({ ...prefs, accounts })} />)}
      {row(
        "보유 종목",
        <SortControl fill className={W} label="보유 종목 정렬" options={HOLDING_SORTS} value={prefs.holdings} onChange={(holdings) => update({ ...prefs, holdings })} />,
      )}
      {row(
        "거래 내역",
        <div role="radiogroup" aria-label="거래 내역 정렬" className={`${W} flex shrink-0 rounded-lg bg-surface-2 p-0.5 text-sm`}>
          {(["new", "old"] as const).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={prefs.trades === o}
              onClick={() => update({ ...prefs, trades: o })}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium ${prefs.trades === o ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
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
