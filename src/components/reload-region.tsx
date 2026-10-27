"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type TransitionStartFunction } from "react";
import { Spinner } from "./spinner";

/**
 * 앱 공통 로딩 동작 (대메뉴 이동 제외): 기간·필터 등을 바꿔 일부 데이터를 새로 불러오는 동안
 * 바뀌는 영역 위에 어두운 반투명 막을 깔고 그 가운데에 스피너를 보여 준다.
 *  - 조작하는 쪽(필터·탭·검색·정렬·기간 버튼)은 useReload()의 start로 주소를 바꾼다
 *  - 바뀌는 영역은 <ReloadRegion>으로 감싼다
 */
const Ctx = createContext<{ pending: boolean; start: TransitionStartFunction }>({
  pending: false,
  start: (fn) => void fn(),
});

export function ReloadProvider({ children }: { children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return <Ctx.Provider value={{ pending, start }}>{children}</Ctx.Provider>;
}

/** 주소를 바꿀 때 start(() => router.replace(...))로 감싸면 그동안 영역이 로딩 상태가 된다 */
export const useReload = () => useContext(Ctx);

/** 아래 메뉴가 가리는 높이 (휴대폰) */
const bottomInset = () => (window.innerWidth < 768 ? 64 : 0);

export function ReloadRegion({ loading = false, className = "", children }: { loading?: boolean; className?: string; children: React.ReactNode }) {
  const { pending } = useReload();
  const active = loading || pending;
  const ref = useRef<HTMLDivElement>(null);
  const [y, setY] = useState<number | null>(null);

  // 스피너는 영역 가운데. 영역이 화면보다 길면 지금 보이는 부분의 가운데 (스크롤해도 따라온다)
  useEffect(() => {
    if (!active) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, window.innerHeight - bottomInset());
      setY(Math.min(Math.max((top + bottom) / 2 - r.top, 0), r.height));
    };
    place();
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [active]);

  return (
    <div ref={ref} className={`relative ${className}`} aria-busy={active}>
      {children}
      {active && (
        <div className="absolute inset-0 z-10 rounded-2xl bg-black/40" role="presentation">
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: y ?? "50%" }}>
            <Spinner className="size-8 border-[3px]" />
          </div>
        </div>
      )}
    </div>
  );
}
