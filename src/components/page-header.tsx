/**
 * 화면 머리글. PC·모바일 모두 같은 배치:
 * 1줄 제목 + 동작 버튼(오른쪽) / 2줄 보조 설명 / 3줄 보기 설정(toolbar: 계좌 선택, 통화 전환 등)
 */
export function PageHeader({
  title,
  sub,
  children,
  toolbar,
}: {
  title: string;
  sub?: React.ReactNode;
  /** 동작 버튼 (추가, 수정 등) */
  children?: React.ReactNode;
  /** 목록을 어떻게 볼지 정하는 설정. 왼쪽·오른쪽 끝으로 나뉘어 놓인다 */
  toolbar?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-bold md:text-2xl" title={title}>
          {title}
        </h1>
        {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
      </div>
      {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      {/* 사이드바 때문에 화면 폭과 실제 폭이 달라서, 툴바 안쪽은 이 폭(@container)을 기준으로 배치한다 */}
      {toolbar && (
        <div className="@container mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">{toolbar}</div>
        </div>
      )}
    </div>
  );
}
