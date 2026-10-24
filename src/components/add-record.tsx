"use client";

import { useState } from "react";
import { CashForm } from "./cash-form";
import { DividendForm, type DividendStock } from "./dividend-form";
import { PlusIcon } from "./icons";
import { Dialog, TradeForm } from "./trade-form";

type Kind = "trade" | "dividend" | "cash";
const KIND_LABEL: Record<Kind, string> = { trade: "매수·매도", dividend: "배당", cash: "입출금·환전" };

/** 거래내역의 '추가': 매수·매도, 배당, 입출금·환전을 한 곳에서 등록한다 */
export function AddRecordButton({
  accounts,
  stocks,
  defaultAccountId,
}: {
  accounts: { id: string; name: string }[];
  stocks: DividendStock[];
  defaultAccountId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("trade");
  const close = () => setOpen(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)} disabled={accounts.length === 0}>
        <PlusIcon className="size-4" /> 추가
      </button>
      <Dialog title="거래 추가" open={open} onClose={close}>
        <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${kind === k ? "border-brand text-brand" : "border-transparent text-ink-2"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {kind === "trade" && <TradeForm accounts={accounts} defaultAccountId={defaultAccountId} onDone={close} />}
        {kind === "dividend" && <DividendForm accounts={accounts} stocks={stocks} defaultAccountId={defaultAccountId} onDone={close} />}
        {kind === "cash" && <CashForm accounts={accounts} defaultAccountId={defaultAccountId} onDone={close} />}
      </Dialog>
    </>
  );
}
