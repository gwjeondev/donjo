"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { applyThemePref, readThemePref, type ThemePref } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

const OPTIONS = [
  { value: "light", label: "밝게", Icon: SunIcon },
  { value: "dark", label: "어둡게", Icon: MoonIcon },
  { value: "system", label: "시스템", Icon: MonitorIcon },
] as const;

/** 밝게 / 어둡게 / 시스템 테마 선택. full이면 아이콘 옆에 글자도 표시 */
export function ThemeToggle({ full = false }: { full?: boolean }) {
  // 서버 렌더링 시점에는 저장값을 알 수 없으므로 마운트 후에 읽는다
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    const saved = readThemePref();
    setPref(saved);
    applyThemePref(saved);
  }, []);

  const changeTheme = (value: ThemePref) => {
    if (value === pref) return;
    const apply = () => {
      flushSync(() => setPref(value));
      applyThemePref(value);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    // 지원 브라우저: 화면 전체를 교차 페이드. 미지원: 색 전환(transition)만 적용
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(apply);
      return;
    }
    const root = document.documentElement;
    root.classList.add("theme-fading");
    apply();
    window.setTimeout(() => root.classList.remove("theme-fading"), 550);
  };

  return (
    <div role="radiogroup" aria-label="화면 테마" className={`flex rounded-lg bg-surface-2 p-0.5 ${full ? "w-full" : ""}`}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => changeTheme(value)}
            className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md py-1.5 text-xs font-medium transition ${full ? "px-1" : "px-2"} ${
              active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
            {full && label}
          </button>
        );
      })}
    </div>
  );
}
