"use client";

import { useState, useTransition } from "react";
import { localizeAllStockNames } from "@/app/actions";

/** 모든 국내 종목 이름을 증권사 표기 이름으로 (직접 바꾼 이름도 덮어씀) */
export function LocalizeNamesButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn-ghost"
        disabled={pending}
        onClick={() => {
          if (!confirm("직접 바꾼 이름을 포함해 모든 국내 종목 이름을 증권사 표기 이름으로 바꿀까요?")) return;
          start(async () => setMessage((await localizeAllStockNames()).message ?? ""));
        }}
      >
        {pending ? "바꾸는 중…" : "국내 종목 이름을 공식 이름으로"}
      </button>
      {message && <span className="text-sm text-ink-2">{message}</span>}
    </div>
  );
}
