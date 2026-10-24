"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "donjo:visits";

/** 이 탭에서 앱 화면을 몇 번 열었는지 센다 (레이아웃에 한 번 둔다). 뒤로 갈 앱 화면이 있는지 판단용 */
export function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, String(Number(sessionStorage.getItem(KEY) ?? 0) + 1));
    } catch {}
  }, [path]);
  return null;
}

/**
 * ← 뒤로: 이 화면으로 들어온 앱 안의 화면으로 돌아간다.
 * 주소로 바로 열었거나 새 탭으로 연 경우(돌아갈 앱 화면이 없음)에는 fallback으로 간다.
 */
export function BackLink({ fallback, label = "뒤로" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-ink-2 hover:text-ink"
      onClick={() => {
        let visits = 0;
        try {
          visits = Number(sessionStorage.getItem(KEY) ?? 0);
        } catch {}
        if (visits > 1) router.back();
        else router.push(fallback);
      }}
    >
      ← {label}
    </button>
  );
}
