// 화면 이동 중 DB를 읽는 동안 보여 주는 뼈대 화면
function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton-bar rounded-lg ${className}`} />;
}

export default function Loading() {
  return (
    <div aria-busy aria-label="불러오는 중">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Block className="h-7 w-32" />
        <Block className="h-9 w-28" />
      </div>
      <Block className="mb-5 h-4 w-56" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card space-y-3 p-5">
            <Block className="h-4 w-20" />
            <Block className="h-8 w-40" />
            <Block className="h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="card mt-4 space-y-3 p-5">
        <Block className="h-5 w-24" />
        <Block className="h-56 w-full" />
      </div>
    </div>
  );
}
