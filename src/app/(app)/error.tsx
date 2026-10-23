"use client";

import { useEffect } from "react";

// 페이지에서 예상하지 못한 오류가 나면 흰 화면 대신 보여 주는 안내 화면
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">일시적인 오류가 발생했어요</h1>
      <p className="mt-2 text-sm text-ink-2">잠시 후 다시 시도해 주세요. 문제가 계속되면 아래 오류 코드를 알려 주세요.</p>
      {error.digest && <p className="mt-3 font-mono text-xs text-muted">오류 코드: {error.digest}</p>}
      <button className="btn-primary mt-6" onClick={reset}>
        다시 시도
      </button>
    </div>
  );
}
