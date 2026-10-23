"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { refreshQuotes } from "@/app/actions";
import { fmtQty } from "@/lib/format";
import { RefreshIcon } from "./icons";

const AUTO_REFRESH_AFTER_MS = 5 * 60 * 1000;

function ago(iso: string, now: number) {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}

/** 환율·시세 시각 표시와 새로고침. 앱으로 돌아왔을 때 화면이 5분 넘게 지났으면 자동으로 다시 불러온다 */
export function FxNote({ fx, quotedAt }: { fx: { rate: number; live: boolean }; quotedAt?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    shownAt.current = Date.now();
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - shownAt.current > AUTO_REFRESH_AFTER_MS) {
        shownAt.current = Date.now();
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, quotedAt]);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <span>USD/KRW {fmtQty(Math.round(fx.rate * 100) / 100)}</span>
      {!fx.live && <span>(기본값 · 환율 조회 실패)</span>}
      <span aria-hidden>·</span>
      <span>
        {quotedAt && now ? `${ago(quotedAt, now)} 시세` : "지연 시세"}
      </span>
      <button
        type="button"
        onClick={() =>
          start(async () => {
            await refreshQuotes();
            router.refresh();
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-brand hover:bg-brand/10 disabled:opacity-60"
        aria-label="시세 새로고침"
        title="시세 새로고침"
      >
        <RefreshIcon className={`size-3.5 ${pending ? "animate-spin" : ""}`} />
        <span className="text-xs">{pending ? "갱신 중" : "새로고침"}</span>
      </button>
    </span>
  );
}
