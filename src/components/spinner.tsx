/** 빙글빙글 도는 동그라미: 화면 전체가 아니라 일부 데이터를 새로 불러오는 중일 때 쓴다 */
export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="불러오는 중"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-line border-t-brand ${className}`}
    />
  );
}
