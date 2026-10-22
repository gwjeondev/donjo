const krw = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 6 });

export const fmtKrw = (n: number) => `${krw.format(Math.round(n))}원`;
export const fmtKrwShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(a >= 1e10 ? 0 : 2)}억`;
  if (a >= 1e4) return `${krw.format(Math.round(n / 1e4))}만`;
  return krw.format(Math.round(n));
};
export const fmtPrice = (n: number, currency: "KRW" | "USD") =>
  currency === "USD" ? `$${usd.format(n)}` : fmtKrw(n);
export const fmtQty = (n: number) => qty.format(n);
export const fmtPct = (r: number, signed = true) =>
  `${signed && r > 0 ? "+" : ""}${(r * 100).toFixed(2)}%`;
export const fmtSigned = (n: number) => `${n > 0 ? "+" : ""}${fmtKrw(n)}`;

/** 한국 시장 관례: 상승 빨강, 하락 파랑 */
export const tone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted");

export const MARKET_LABEL = { KOSPI: "코스피", KOSDAQ: "코스닥", US: "미국" } as const;
