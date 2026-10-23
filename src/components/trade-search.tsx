"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

/** 매매기록 종목 검색 (종목명·종목코드). 입력을 멈추면 주소의 ?q= 를 바꿔 목록을 거른다 */
export function TradeSearch({ value = "" }: { value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      const q = text.trim();
      if (q) next.set("q", q);
      else next.delete("q");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // params는 의도적으로 제외: 다른 필터를 바꿀 때 검색어를 다시 적용하지 않도록
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        className="input pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
        placeholder="종목명·종목코드 검색"
        aria-label="종목 검색"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button
          type="button"
          onClick={() => setText("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
          aria-label="검색어 지우기"
        >
          <CloseIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
