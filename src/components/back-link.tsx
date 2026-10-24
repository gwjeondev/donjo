"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "donjo:nav";
const ROOT_FLAG = "donjo:navroot";
const POP_FLAG = "donjo:navpop";

/** 상세 화면: 앱 안 기록이 없어도(주소로 바로 연 경우) 뒤로를 보여 주고, 그때 갈 곳 */
function fallbackOf(path: string) {
  if (/^\/stocks\/.+/.test(path)) return "/stocks";
  if (/^\/accounts\/.+/.test(path)) return "/accounts";
  return null;
}

type Entry = { path: string; root: boolean };

function write(stack: Entry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-30)));
  } catch {}
}

/** 방금 뒤로 가기였다는 표시 (잠깐만 유효: 남아 있다가 다음 이동을 뒤로 가기로 착각하지 않게) */
function markPop() {
  try {
    sessionStorage.setItem(POP_FLAG, String(Date.now()));
  } catch {}
}

function read(): Entry[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function view(stack: Entry[], path: string) {
  const cur = stack.at(-1);
  const fallback = fallbackOf(path);
  return { back: (!!cur && !cur.root && stack.length > 1) || !!fallback, fallback };
}

/**
 * 모든 화면 맨 위의 '← 뒤로'.
 * 메뉴(사이드바·아래 메뉴·로고·설정)로 연 화면은 첫 화면이라 뒤로를 숨기고,
 * 화면 안의 링크(카드·바로가기 등)로 들어온 화면에는 뒤로를 보여 준다. 누르면 들어온 화면으로 돌아간다.
 * 이 탭에서 지나온 화면을 sessionStorage에 쌓아 두고, 화면 경로(주소의 ? 앞)가 바뀔 때마다 갱신한다.
 */
export function PageBack() {
  const path = usePathname();
  const router = useRouter();
  const [show, setShow] = useState<{ back: boolean; fallback: string | null }>({ back: false, fallback: null });

  // 메뉴 링크를 누르면 다음 화면을 '첫 화면'으로 표시한다
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("a[data-nav-root]")) {
        try {
          sessionStorage.setItem(ROOT_FLAG, "1");
        } catch {}
      }
    };
    // 브라우저 뒤로 가기: Next가 화면을 먼저 바꿔서 아래 기록 갱신이 '앞으로 이동'으로 쌓였으면([.., A, B, A]) 되돌린다
    const onPop = () => {
      const stack = read();
      const here = window.location.pathname;
      if (stack.length >= 3 && stack.at(-1)!.path === here && stack.at(-3)!.path === here) {
        const next = stack.slice(0, -2);
        write(next);
        setShow(view(next, here));
      } else markPop();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    let stack = read();
    let fromMenu = false;
    let popped = false;
    try {
      fromMenu = sessionStorage.getItem(ROOT_FLAG) === "1";
      popped = Date.now() - Number(sessionStorage.getItem(POP_FLAG) ?? 0) < 1500;
      sessionStorage.removeItem(ROOT_FLAG);
      sessionStorage.removeItem(POP_FLAG);
    } catch {}
    const top = stack.at(-1);
    if (!top) stack = [{ path, root: !fallbackOf(path) }];
    else if (fromMenu) stack = [...stack, { path, root: true }]; // 메뉴로 연 화면은 첫 화면 (브라우저 뒤로 가기는 그대로 맞도록 기록은 이어 둔다)
    else if (top.path === path) {
      // 새로고침
    } else if (popped && stack.at(-2)?.path === path) stack = stack.slice(0, -1); // 뒤로 가기 (링크로 같은 화면에 다시 가는 건 앞으로 쌓는다)
    else stack = [...stack, { path, root: false }];
    write(stack);
    setShow(view(stack, path));
  }, [path]);

  if (!show.back) return null;
  return (
    <button
      type="button"
      className="mb-2 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      onClick={() => {
        const stack = read();
        if (stack.length > 1 && !stack.at(-1)!.root) {
          markPop();
          router.back();
        } else router.push(show.fallback ?? "/dashboard");
      }}
    >
      ← 뒤로
    </button>
  );
}
