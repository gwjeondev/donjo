import { fmtQty } from "@/lib/format";

export function FxNote({ fx }: { fx: { rate: number; live: boolean } }) {
  return (
    <span>
      USD/KRW {fmtQty(Math.round(fx.rate * 100) / 100)}
      {!fx.live && " (기본값 · 환율 조회 실패)"} · 시세는 지연 데이터입니다
    </span>
  );
}
