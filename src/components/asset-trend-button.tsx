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
        {trend ? (
          <AssetChart points={trend.points} failed={trend.failed} withCash={trend.withCash} bare />
        ) : error ? (
          <div className="py-12 text-center text-sm text-muted">
            <p>자산 추이를 불러오지 못했어요.</p>
            <button type="button" className="btn-ghost mt-3" onClick={show}>
              다시 시도
            </button>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-muted" aria-busy>
            불러오는 중…
          </p>
        )}
      </Dialog>
    </>
  );
}
