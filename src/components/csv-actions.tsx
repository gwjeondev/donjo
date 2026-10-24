"use client";

import { useEffect, useState } from "react";
import { importTrades } from "@/app/actions";
import { CSV_COLUMNS } from "@/lib/csv";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { DownloadIcon, UploadIcon } from "./icons";
import { Dialog } from "./trade-form";

/** 거래내역 CSV 내보내기 (compact면 모바일에서 아이콘만: 좁은 머리글용) */
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
          <b>내보내기</b>로 받은 파일과 같은 형식의 CSV를 올려 주세요. 첫 줄은 열 이름이에요.
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-muted">{CSV_COLUMNS.join(", ")}</p>
        <ul className="mt-2 list-disc space-y-0.5 pl-4">
          <li>구분: 매수/매도/배당/입금/출금/환전 · 시장: 국내/해외 · 거래일: YYYY-MM-DD</li>
          <li>배당: 단가 칸에 세전 배당금, 세금 칸에 원천징수액 · 입출금·환전: 종목코드 칸에 통화(KRW/USD), 단가 칸에 금액</li>
          <li>시장·수수료·세금·환율·메모는 비워도 돼요 (시장은 종목코드로 판단하고, 해외 주식 환율은 거래일 환율로 채워요)</li>
          <li>최신순·오래된순 어느 쪽으로 정렬된 파일이든 괜찮아요</li>
          <li>없는 계좌는 새로 만들고, 이미 있는 기록은 건너뛰어요</li>
          <li>한 줄이라도 잘못되면 아무것도 저장하지 않아요</li>
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

/** CSV로 거래내역 가져오기 */
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
