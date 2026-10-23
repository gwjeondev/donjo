"use client";

import { useEffect, useState } from "react";
import { importTrades } from "@/app/actions";
import { CSV_COLUMNS } from "@/lib/csv";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { DownloadIcon, UploadIcon } from "./icons";
import { Dialog } from "./trade-form";

/** 매매 기록 CSV 내보내기 (compact면 모바일에서 아이콘만: 좁은 머리글용) */
export function ExportButton({ accountId, compact = true }: { accountId?: string; compact?: boolean }) {
  return (
    <a
      href={`/api/export${accountId ? `?account=${accountId}` : ""}`}
      className={compact ? "btn-ghost px-2.5 sm:px-3.5" : "btn-ghost"}
      title="CSV로 내보내기"
      aria-label="CSV로 내보내기"
      download
    >
      <DownloadIcon className="size-4" />
      <span className={compact ? "hidden sm:inline" : ""}>{compact ? "내보내기" : "CSV로 내보내기"}</span>
    </a>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const { state, pending, onSubmit } = useFormAction(importTrades);
  useEffect(() => {
    if (state.ok) {
      const t = window.setTimeout(onDone, 1500);
      return () => window.clearTimeout(t);
    }
  }, [state, onDone]);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
        <p>
          <b>내보내기</b>로 받은 파일과 같은 형식의 CSV를 올려 주세요. 첫 줄은 열 이름입니다.
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-muted">{CSV_COLUMNS.join(", ")}</p>
        <ul className="mt-2 list-disc space-y-0.5 pl-4">
          <li>구분: 매수/매도 · 시장: 코스피/코스닥/미국 · 거래일: YYYY-MM-DD</li>
          <li>수수료·세금·환율·메모는 비워도 됩니다 (미국 주식은 환율 필요)</li>
          <li>없는 계좌는 새로 만들고, 이미 있는 기록은 건너뜁니다</li>
          <li>한 줄이라도 잘못되면 아무것도 저장하지 않습니다</li>
        </ul>
      </div>
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-ink-2 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
      />
      {state.error && <p className="whitespace-pre-line text-sm text-up">{state.error}</p>}
      {state.message && <p className="text-sm text-ink">{state.message}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "가져오는 중…" : "가져오기"}
      </button>
    </form>
  );
}

/** CSV로 매매 기록 가져오기 */
export function ImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost px-2.5 sm:px-3.5" onClick={() => setOpen(true)} title="CSV 가져오기" aria-label="CSV 가져오기">
        <UploadIcon className="size-4" />
        <span className="hidden sm:inline">가져오기</span>
      </button>
      <Dialog title="CSV 가져오기" open={open} onClose={() => setOpen(false)}>
        <ImportForm onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
