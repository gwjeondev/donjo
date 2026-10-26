"use client";

import { useEffect, useState } from "react";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { saveAccount } from "@/app/actions";
import { EditIcon, PlusIcon } from "./icons";
import { DeleteAccountButton } from "./delete-account";
import { Dialog } from "./trade-form";
import { ACCOUNT_KIND_LABEL } from "@/lib/autodiv";

interface Account {
  id: string;
  name: string;
  broker: string | null;
  memo: string | null;
  kind?: string;
}

function AccountForm({ initial, onDone }: { initial?: Account; onDone: () => void }) {
  const { state, pending, onSubmit } = useFormAction(saveAccount);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label className="label" htmlFor="acc-name">계좌 이름</label>
        <input id="acc-name" name="name" className="input" required defaultValue={initial?.name} placeholder="예: 키움 일반, 미래에셋 ISA" />
      </div>
      <div>
        <label className="label" htmlFor="acc-kind">계좌 종류</label>
        <select id="acc-kind" name="kind" className="input" defaultValue={initial?.kind ?? "GENERAL"}>
          {(Object.keys(ACCOUNT_KIND_LABEL) as (keyof typeof ACCOUNT_KIND_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {ACCOUNT_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted" data-wrap="ok">
          자동 배당의 세금 계산에 써요. 일반 계좌는 국내 배당 15.4%, ISA·연금은 받을 때 떼지 않아요. 미국 배당은 어느 계좌든 15%예요.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="acc-broker">증권사 (선택)</label>
        <input id="acc-broker" name="broker" className="input" defaultValue={initial?.broker ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="acc-memo">메모 (선택)</label>
        <input id="acc-memo" name="memo" className="input" defaultValue={initial?.memo ?? ""} />
      </div>
      {state.error && <p className="text-sm text-up">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "저장 중…" : "저장"}</button>
      {initial && (
        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">계좌를 지우면 매매·배당·현금 기록도 모두 함께 삭제돼요.</p>
          <DeleteAccountButton id={initial.id} name={initial.name} />
        </div>
      )}
    </form>
  );
}

export function AccountButton({ initial }: { initial?: Account }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {initial ? (
        <button className="btn-ghost" onClick={() => setOpen(true)}><EditIcon className="size-4" /> 계좌 수정</button>
      ) : (
        <button className="btn-primary" onClick={() => setOpen(true)}><PlusIcon className="size-4" /> 계좌 추가</button>
      )}
      <Dialog title={initial ? "계좌 수정" : "계좌 추가"} open={open} onClose={() => setOpen(false)}>
        <AccountForm initial={initial} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
