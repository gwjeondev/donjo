"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InfoIcon } from "./icons";
import { Dialog } from "./trade-form";

const GAP = 6;
const EDGE = 16;

/**
 * 제목 옆 ⓘ: 눌러서 설명을 연다. 설명 길이와 상관없이 같은 방식이다.
 *  - 휴대폰(좁은 화면): 아래에서 올라오는 시트
 *  - PC: 버튼 옆 말풍선 (높이 상한, 넘치면 안에서 스크롤)
 * 바깥을 누르거나 ESC로 닫는다.
 */
export function InfoTip({ title, children }: { title: string; children: React.ReactNode }) {
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<false | "sheet" | "pop">(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);

  // 말풍선 위치: 버튼 아래(공간이 모자라면 위), 화면 밖으로 나가지 않게
  useLayoutEffect(() => {
    if (open !== "pop" || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - EDGE * 2);
    const left = Math.min(Math.max(r.left - 12, EDGE), window.innerWidth - width - EDGE);
    const below = window.innerHeight - r.bottom;
    // 아래(또는 위) 남은 공간만큼만 늘어나고, 넘치면 안에서 스크롤
    const down = below >= 220 || below >= r.top;
    const maxHeight = Math.min(416, (down ? below : r.top) - GAP - EDGE);
    setPos(down ? { left, top: r.bottom + GAP, width, maxHeight } : { left, bottom: window.innerHeight - r.top + GAP, width, maxHeight });
  }, [open]);

  useEffect(() => {
    if (open !== "pop") return;
    const close = () => setOpen(false);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`${title} 설명`}
        aria-expanded={!!open}
        onClick={() => setOpen((o) => (o ? false : window.matchMedia("(min-width: 640px)").matches ? "pop" : "sheet"))}
        className="inline-grid size-6 shrink-0 place-items-center rounded-full align-middle text-muted transition hover:bg-surface-2 hover:text-ink"
      >
        <InfoIcon className="size-4" />
      </button>
      {/* 제목(h2) 안에 놓이므로 열리는 창은 body에 그린다 */}
      {open === "pop" &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={title}
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
            className="z-50 overflow-y-auto rounded-xl border border-line bg-surface p-4 text-left text-sm font-normal leading-relaxed text-ink-2 shadow-lg"
          >
            <p className="mb-1.5 font-semibold text-ink">{title}</p>
            <div className="space-y-2">{children}</div>
          </div>,
          document.body,
        )}
      {/* 시트는 닫힐 때 애니메이션이 끝날 때까지 남아 있도록 항상 그려 둔다 (브라우저에서만) */}
      {ready &&
        createPortal(
          <Dialog title={title} open={open === "sheet"} onClose={() => setOpen(false)}>
            <div className="space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
          </Dialog>,
          document.body,
        )}
    </>
  );
}
