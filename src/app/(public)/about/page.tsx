import Link from "next/link";
import { auth } from "@/auth";
import { ChartIcon, CoinIcon, DownloadIcon, HomeIcon, ListIcon, RefreshIcon, SettingsIcon, StockIcon, WalletIcon } from "@/components/icons";

export const metadata = {
  title: "돈조 소개",
  description: "계좌별 매매·배당·현금 기록으로 내 자산과 수익률, 손익, 양도세까지 정확하게 보여 주는 주식 투자 관리 앱",
};

// 화면(메뉴)별로 할 수 있는 일
const FEATURES = [
  {
    Icon: HomeIcon,
    title: "대시보드",
    desc: "내 자산 전체를 한 화면에서 봐요.",
    points: [
      "총자산(주식 + 현금)과 오늘 등락, 주식·원화·달러 현금 내역",
      "평가손익·수익률, 실현손익과 배당을 더한 총손익",
      "자산 추이 그래프와 기간 중 총자산 변화 (1M·3M·YTD·1Y·전체)",
      "종목·시장(국내/해외)·계좌별 자산 비중",
    ],
  },
  {
    Icon: StockIcon,
    title: "종목",
    desc: "가진 종목을 카드로 모아 보고, 종목마다 자세히 봐요.",
    points: [
      "계좌·국내/해외로 거르고 평가금액·수익률·손익·오늘 등락·이름순으로 정렬",
      "종목 상세: 현재가, 평단가, 평가·실현손익, 가격 추이와 매수·매도 지점, 계좌별 보유",
      "그 종목의 거래내역·손익으로 바로 가기",
    ],
  },
  {
    Icon: WalletIcon,
    title: "계좌",
    desc: "일반·ISA·연금·해외주식 계좌를 나눠 기록해요.",
    points: [
      "계좌마다 총자산·평가손익·실현손익과 현금",
      "계좌 상세: 보유 종목과 그 계좌의 거래내역·수익률·손익 바로 가기",
    ],
  },
  {
    Icon: ListIcon,
    title: "거래내역",
    desc: "매수·매도, 배당, 입금·출금·환전을 한곳에서 기록하고 고쳐요.",
    points: [
      "한글 종목 검색, 국내·미국 주식, 소수점 수량",
      "기간(1M·3M·YTD·1Y·전체·직접입력), 계좌, 종류, 국내/해외, 종목 검색으로 거르기",
      "최신순·오래된순 정렬, 해외 종목 원화/달러 보기",
    ],
  },
  {
    Icon: ChartIcon,
    title: "수익률",
    desc: "넣고 뺀 돈의 영향을 뺀 순수한 투자 성과를 봐요.",
    points: [
      "코스피·S&P 500·나스닥 100과 같은 기간 비교",
      "일별·월별·연도별 수익률과 투자 손익",
      "기간을 누르면 그 기간의 거래내역으로 이동",
    ],
  },
  {
    Icon: CoinIcon,
    title: "손익",
    desc: "확정된 돈과 세금을 정리해요.",
    points: [
      "실현손익: 매도 건마다 손익·수익률 (원화/달러)과 해외 종목의 환차손익, 평균 매수·매도환율",
      "배당금: 세전·세금·받은 금액 (원화/달러)",
      "양도세: 해외 주식의 연간 양도차익과 예상 세액",
    ],
  },
  {
    Icon: RefreshIcon,
    title: "현금 관리",
    desc: "계좌마다 원화·달러 현금을 따로 관리해요.",
    points: [
      "따로 관리: 입금·출금·환전으로 넣은 금액만 현금으로 봐요",
      "매매와 연동: 켠 뒤에 기록한 매수·매도·배당부터 현금이 함께 움직여요 (국내는 원화, 미국은 달러)",
    ],
  },
  {
    Icon: DownloadIcon,
    title: "내 기록은 내 것",
    desc: "매매·배당·현금 기록을 엑셀용 CSV로 내려받고, 다시 가져올 수 있어요. 이미 있는 기록은 건너뛰어요.",
    points: [],
  },
  {
    Icon: SettingsIcon,
    title: "설정",
    desc: "밝게·어둡게·시스템 테마, 목록 기본 정렬, 현금 관리 방식, 국내 종목 공식 이름 맞추기를 정해요.",
    points: [],
  },
];

const HOW = [
  ["평균단가", "이동평균법으로 계산해요. 화면의 평단가는 증권사처럼 수수료·세금을 뺀 매수 단가이고, 손익과 양도세는 수수료·세금을 매입원가에 포함해 계산해요."],
  ["해외 주식 원화 환산", "매입금액은 매수한 날의 환율, 평가금액은 현재 환율로 환산해서 환차손익도 손익에 들어가요."],
  ["실현손익", "매도 대금(수수료·세금 뺀 금액)에서 판 수량의 평균 매입금액을 뺀 값이에요. 배당금은 따로 모아요."],
  ["수익률", "시간가중수익률(TWR)이에요. 중간에 돈을 더 넣거나 뺀 효과를 빼서, 투자 자체의 성과만 보여 줘요."],
  ["자산 증가율", "수익률 화면의 기간별 표에 있어요. 추가 매수까지 포함한 평가금액의 단순 증감률이라, 수익률과 함께 보면 '얼마나 모았는지'와 '얼마나 잘 굴렸는지'를 나눠 볼 수 있어요."],
  ["자산 추이", "날짜별 총자산(주식 + 현금)이에요. 입출금이 그대로 반영돼서, 기간 변화는 그동안 자산이 실제로 늘거나 준 금액이에요."],
  ["양도세", "해외 상장 주식의 1년 이익과 손실을 합쳐 기본공제 250만 원을 빼고 22%를 곱한 예상액이에요. 취득가액은 이동평균이에요."],
  ["현금", "총자산의 달러 현금은 오늘 환율로 원화 환산해 더해요."],
];

export default async function AboutPage() {
  const loggedIn = !!(await auth())?.user;
  return (
    <main className="mx-auto max-w-4xl px-4 pb-16 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8">
      <nav className="flex items-center">
        <Link href={loggedIn ? "/dashboard" : "/login"} className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
          <span className="text-lg font-bold">돈조</span>
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
          돈조는 여러 증권 계좌의 매수·매도, 배당, 현금 기록을 모아 평균단가부터 수익률, 실현손익, 해외주식 양도세까지
          계산해 주는 주식 투자 관리 앱이에요.
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
          {FEATURES.map(({ Icon, title, desc, points }, i) => (
            // 홀수 개일 때 마지막 카드는 두 칸을 차지해 혼자 남지 않게
            <div
              key={title}
              className={`card p-5 ${i === FEATURES.length - 1 && FEATURES.length % 2 ? "sm:col-span-2" : ""}`}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{desc}</p>
              {points.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-ink-2">
                  {points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              )}
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
          <li>증권사 계좌와 직접 연결되지 않아요. 기록은 직접 입력하거나 CSV로 가져와요.</li>
          <li>돈조가 보여 주는 숫자는 기록을 바탕으로 한 참고용 계산이며, 투자 권유나 세무 자문이 아니에요. 양도세는 실제 신고 전에 증권사 자료로 확인해 주세요.</li>
          <li>홈 화면에 추가하면 앱처럼 쓸 수 있어요. (아이폰: 공유 → 홈 화면에 추가, 안드로이드: 메뉴 → 앱 설치)</li>
        </ul>
      </section>

      <footer className="mt-16 border-t border-line pt-6 text-center text-xs text-muted">
        <p>
          문의{" "}
          <a href="mailto:gw4609@gmail.com" className="font-medium text-ink-2 hover:text-brand">
            gw4609@gmail.com
          </a>
        </p>
      </footer>
    </main>
  );
}
