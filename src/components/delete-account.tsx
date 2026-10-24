"use client";

import { useTransition } from "react";
import { deleteAccount } from "@/app/actions";
import { TrashIcon } from "./icons";

export function DeleteAccountButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm(`"${name}" 계좌와 모든 거래 기록(매매·배당·현금)을 삭제할까요? 되돌릴 수 없어요.`)) start(() => deleteAccount(id));
      }}
    >
      <TrashIcon className="size-4" /> 계좌 삭제
    </button>
  );
}
