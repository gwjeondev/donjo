"use client";

import { useEffect, useState } from "react";
import { renameStock } from "@/app/actions";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { EditIcon } from "./icons";
import { Dialog } from "./trade-form";

function RenameForm({ symbol, name, onDone }: { symbol: string; name: string; onDone: () => void }) {
  const { state, pending, onSubmit } = useFormAction(renameStock);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="symbol" value={symbol} />
      <div>
        <label className="label" htmlFor="stock-name">
          표시할 이름
        </label>
        <input id="stock-name" name="name" className="input" defaultValue={name} required maxLength={100} autoFocus />
        <p className="mt-1.5 text-xs text-muted">
          모든 계좌의 이 종목 기록에 적용돼요. 예: &quot;TIGER 미국필라델피아반도체&quot;
        </p>
      </div>
      {state.error && <p className="text-sm text-up">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}

/** 종목 표시 이름 변경 (긴 영문 정식 명칭을 알아보기 쉬운 이름으로) */
export function RenameStockButton({ symbol, name }: { symbol: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost px-2.5 sm:px-3.5" onClick={() => setOpen(true)} title="이름 변경" aria-label="이름 변경">
        <EditIcon className="size-4" />
        <span className="hidden sm:inline">이름 변경</span>
      </button>
      <Dialog title="종목 이름 변경" open={open} onClose={() => setOpen(false)}>
        <RenameForm symbol={symbol} name={name} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
