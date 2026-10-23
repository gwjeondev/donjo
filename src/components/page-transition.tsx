"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// 하단 탭 순서. 오른쪽 탭으로 가면 오른쪽에서, 왼쪽 탭으로 가면 왼쪽에서 들어온다.
// 하위 화면(예: 계좌 상세)은 부모 탭보다 한 단계 오른쪽으로 본다.
const ORDER = ["/dashboard", "/accounts", "/transactions", "/performance"];

function rank(path: string) {
  if (path.startsWith("/stocks/")) return 0.5;
  const i = ORDER.findIndex((p) => path === p || path.startsWith(`${p}/`));
  return i < 0 ? 0 : i + (path === ORDER[i] ? 0 : 0.5);
}

// 마지막으로 "화면에 반영된" 위치. 렌더링 중에는 바꾸지 않는다
// (전환 중 렌더가 버려지고 다시 실행될 수 있어, 렌더에서 바꾸면 방향이 틀어진다)
let committedRank: number | null = null;

/** (app)/template.tsx에서 쓰며, 화면 이동마다 새로 마운트되어 진입 애니메이션을 재생한다 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const r = rank(path);
  const [className] = useState(() =>
    committedRank == null || r === committedRank ? "page-fade" : r > committedRank ? "page-from-right" : "page-from-left",
  );
  useEffect(() => {
    committedRank = r;
  }, [r]);
  return <div className={className}>{children}</div>;
}
