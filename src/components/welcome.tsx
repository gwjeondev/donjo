import Link from "next/link";
import { ImportButton } from "./csv-actions";
import { AddTradeButton } from "./trade-form";

/** 매매 기록이 하나도 없을 때 대시보드 대신 보여 주는 시작 안내 */
export function Welcome({ accounts }: { accounts: { id: string; name: string }[] }) {
  const steps = [
    {
      title: "계좌 정리하기",
      desc: `증권사 계좌별로 기록을 나눠 관리할 수 있어요. 지금은 ${accounts.map((a) => `"${a.name}"`).join(", ") || "계좌가 없어요"}.`,
      action: (
        <Link href="/accounts" className="btn-ghost">
          계좌 관리
        </Link>
      ),
    },
    {
      title: "첫 매매 기록 추가하기",
      desc: "보유 중인 종목의 매수 기록을 넣으면 평균단가·수익률·자산 추이가 자동으로 계산돼요. 매수한 날짜를 정확히 넣을수록 수익률이 정확해요.",
      action: <AddTradeButton accounts={accounts} />,
    },
    {
      title: "또는 CSV로 한 번에 가져오기",
      desc: "엑셀로 정리해 둔 기록이 있다면 CSV로 저장해 한꺼번에 올릴 수 있어요.",
      action: <ImportButton />,
    },
  ];
  return (
    <div className="card p-6 md:p-8">
      <h2 className="text-lg font-semibold">돈조에 오신 걸 환영해요 👋</h2>
      <p className="mt-1 text-sm text-ink-2">아래 순서대로 시작해 보세요.</p>
      <ol className="mt-6 space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.title}</p>
              <p className="mt-0.5 text-sm text-ink-2">{s.desc}</p>
            </div>
            <div className="shrink-0">{s.action}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
