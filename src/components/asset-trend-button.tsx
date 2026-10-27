"use client";

import { useState } from "react";
import { AssetChart, type AssetPoint } from "./asset-chart";
import { ChevronRightIcon } from "./icons";
import { Dialog } from "./trade-form";

interface Trend {
  points: AssetPoint[];
  withCash: boolean;
  failed: boolean;
}

/** 총자산 카드의 '자산 추이' 버튼: 누르면 팝업을 열고, 그때 데이터를 불러온다 (한 번 불러오면 다시 받지 않는다) */
export function AssetTrendButton() {
  const [open, setOpen] = useState(false);
  const [trend, setTrend] = useState<Trend | null>(null);
  const [error, setError] = useState(false);

  const show = () => {
    setOpen(true);
    if (trend) return;
    setError(false);
    fetch("/api/asset-trend")
      .then((r) => (r.ok ? (r.json() as Promise<Trend>) : Promise.reject(new Error(String(r.status)))))
      .then(setTrend)
      .catch(() => setError(true));
  };

  return (
    <>
      <button type="button" onClick={show} className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand hover:underline">
        자산 추이
        <ChevronRightIcon className="size-4" />
      </button>
      <Dialog title="자산 추이" open={open} onClose={() => setOpen(false)} wide>
        {/* 불러오는 중·실패·완료 모두 같은 틀을 써서 팝업 높이가 변하지 않는다 */}
        <AssetChart
          points={trend?.points ?? []}
          failed={trend?.failed}
          withCash={trend?.withCash}
          bare
          status={trend ? "ready" : error ? "error" : "loading"}
          onRetry={show}
        />
      </Dialog>
    </>
  );
}
