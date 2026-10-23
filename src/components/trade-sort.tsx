"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SortIcon } from "./icons";

export type TradeOrder = "new" | "old";

/** 매매기록 정렬: 최신순 ↔ 오래된순. 설정의 기본값과 다를 때만 주소(?sort=)에 남긴다 */
export function TradeSort({ value, defaultOrder = "new" }: { value: TradeOrder; defaultOrder?: TradeOrder }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const old = value === "old";
  return (
    <button
      type="button"
      onClick={() => {
        const next = new URLSearchParams(params);
        const target: TradeOrder = old ? "new" : "old";
        if (target === defaultOrder) next.delete("sort");
        else next.set("sort", target);
        router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
      }}
      title={old ? "오래된순" : "최신순"}
      aria-label={`정렬: ${old ? "오래된순" : "최신순"} (누르면 ${old ? "최신순" : "오래된순"})`}
      className="btn-ghost size-[42px] gap-1 p-0 sm:size-auto sm:px-2.5 sm:py-2"
    >
      {/* 오래된순일 때는 화살표를 위로 뒤집는다 */}
      <SortIcon className={`size-4 transition-transform ${old ? "-scale-y-100" : ""}`} />
      {/* 좁은 화면에서는 검색창 자리를 위해 아이콘만 */}
      <span className="hidden sm:inline">{old ? "오래된순" : "최신순"}</span>
    </button>
  );
}
