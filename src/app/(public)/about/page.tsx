import Link from "next/link";
import { auth } from "@/auth";
import { ChartIcon, DownloadIcon, ListIcon, RefreshIcon, WalletIcon } from "@/components/icons";

export const metadata = {
  title: "돈조 소개",
  description: "계좌별 매매 기록으로 내 투자 수익률을 정확하게 보여 주는 주식 투자 관리 앱",
};

const FEATURES = [
  {
    Icon: WalletIcon,
    title: "계좌별로 따로, 합쳐서 한눈에",
    desc: "일반·ISA·연금·해외주식 계좌를 나눠 기록하고, 대시보드에서 전체 자산과 비중을 함께 봐요.",
  },
  {
    Icon: ListIcon,
    title: "매수·매도 기록만 넣으면 끝",
    desc: "평균단가, 평가손익, 실현손익을 자동으로 계산해요. 한글로 종목을 검색하고, 현재가도 한 번에 채울 수 있어요.",
  },
  {
    Icon: ChartIcon,
    title: "진짜 내 실력, 수익률",
    desc: "추가 매수로 늘어난 돈은 빼고 순수한 투자 성과만 일·월·연 단위로 보여 주고, 코스피·S&P 500과 비교해요.",
  },
  {
    Icon: RefreshIcon,
    title: "국내·미국 주식, 원화·달러",
    desc: "코스피·코스닥·미국 주식을 함께 관리해요. 해외 종목은 원화와 달러로 바꿔 볼 수 있고 환율 변동까지 반영돼요.",
  },
  {
    Icon: DownloadIcon,
    title: "내 기록은 내 것",
    desc: "모든 매매 기록을 엑셀용 CSV로 내려받고, 다시 불러올 수 있어요.",
  },
];

const HOW = [
  ["평균단가", "이동평균법으로 계산하고, 수수료와 세금은 매입원가에 포함해요."],
  ["해외 주식 원화 환산", "매입금액은 매수한 날의 환율, 평가금액은 현재 환율로 환산해서 환차손익도 손익에 들어가요."],
  ["수익률", "시간가중수익률(TWR)이에요. 중간에 돈을 더 넣거나 뺀 효과를 빼서, 투자 자체의 성과만 보여 줘요."],
  [
    "자산 증가율",
    "추가 매수까지 포함한 평가금액의 단순 증감률이에요. 수익률과 함께 보면 '얼마나 모았는지'와 '얼마나 잘 굴렸는지'를 나눠 볼 수 있어요.",
  ],
];

export default async function AboutPage() {
  const loggedIn = !!(await auth())?.user;
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8">
      <nav className="flex items-center justify-between">
        <Link href={loggedIn ? "/dashboard" : "/login"} className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
          <span className="text-lg font-bold">돈조</span>
        </Link>
        <Link href={loggedIn ? "/dashboard" : "/login"} className="text-sm font-medium text-brand">
          {loggedIn ? "대시보드로" : "로그인"}
        </Link>
      </nav>

      {/* 첫 화면 */}
      <section className="py-14 text-center md:py-20">
        <img
          src="/icons/icon-512.png"
          alt="돈조 로고"
          className="mx-auto size-24 rounded-[1.6rem] shadow-lg md:size-28"
        />
        <h1 className="mt-6 text-3xl font-bold leading-tight md:text-5xl">
          매매 기록만 넣으면
          <br />
          <span className="text-brand">내 수익률</span>이 보여요
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-ink-2 md:text-lg">
          돈조는 여러 증권 계좌의 매수·매도 기록을 모아, 평균단가부터 일·월·연 수익률까지 정확하게 계산해 주는 주식 투자
          관리 앱이에요.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {loggedIn ? (
            <Link href="/dashboard" className="btn-primary px-6 py-3 text-base">
              대시보드로 가기
            </Link>
          ) : (
            <>
              <Link href="/register" className="btn-primary px-6 py-3 text-base">
                무료로 시작하기
              </Link>
              <Link href="/login" className="btn-ghost px-6 py-3 text-base">
                로그인
              </Link>
            </>
          )}
        </div>
      </section>

      {/* 주요 기능 */}
      <section>
        <h2 className="text-xl font-bold md:text-2xl">이런 걸 할 수 있어요</h2>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map(({ Icon, title, desc }, i) => (
            // 홀수 개일 때 마지막 카드는 두 칸을 차지해 혼자 남지 않게
            <div key={title} className={`card p-5 ${i === FEATURES.length - 1 && FEATURES.length % 2 ? "sm:col-span-2" : ""}`}>
              <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 계산 방식 */}
      <section className="mt-14">
        <h2 className="text-xl font-bold md:text-2xl">이렇게 계산해요</h2>
        <dl className="card mt-5 divide-y divide-line">
          {HOW.map(([term, desc]) => (
            <div key={term} className="grid gap-1 p-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-semibold">{term}</dt>
              <dd className="text-sm leading-relaxed text-ink-2">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 안내 */}
      <section className="mt-14">
        <h2 className="text-xl font-bold md:text-2xl">알아 두세요</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
          <li>시세는 Yahoo Finance와 네이버 증권의 공개 데이터를 쓰며, 실시간이 아닌 지연 시세예요.</li>
          <li>증권사 계좌와 직접 연결되지 않아요. 매매 기록은 직접 입력하거나 CSV로 가져와요.</li>
          <li>돈조가 보여 주는 숫자는 기록을 바탕으로 한 참고용 계산이며, 투자 권유나 세무 자문이 아니에요.</li>
          <li>홈 화면에 추가하면 앱처럼 쓸 수 있어요. (아이폰: 공유 → 홈 화면에 추가, 안드로이드: 메뉴 → 앱 설치)</li>
        </ul>
      </section>

      <footer className="mt-16 space-y-1 border-t border-line pt-6 text-center text-xs text-muted">
        <p>
          문의{" "}
          <a href="mailto:gw4609@gmail.com" className="font-medium text-ink-2 hover:text-brand">
            gw4609@gmail.com
          </a>
        </p>
        <p>© 돈조</p>
      </footer>
    </main>
  );
}
