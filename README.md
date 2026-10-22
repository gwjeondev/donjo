# 돈조 (donjo): 주식 투자 관리 앱

계좌별 매수·매도 기록으로 보유 종목, 수익률, 자산 증가율을 관리하는 Next.js 웹앱입니다.
PC 웹은 반응형으로, 모바일에서는 홈 화면에 설치하는 웹앱(PWA)으로 사용합니다.

## 기능

- **로그인**: 이메일/비밀번호 회원가입·로그인 (Auth.js). 데이터는 사용자별로 분리됩니다.
- **계좌별 관리**: 여러 계좌(일반, ISA, 해외주식 등)를 만들고 계좌마다 매수·매도 기록을 관리합니다.
- **매수·매도 기록**: 종목 검색, 수수료·세금, 미국 주식의 거래일 환율(자동 입력 후 수정 가능), 메모를 기록하고 수정·삭제합니다.
  보유 수량을 넘는 매도는 막습니다.
- **보유 종목**: 이동평균법으로 계산한 평균단가, 평가금액, 평가손익, 비중, 실현손익을 보여 줍니다.
- **전체 자산 보기**: 모든 계좌를 합친 평가금액, 오늘 변동, 자산 추이 차트, 종목·시장·계좌별 비중을 보여 줍니다.
- **수익률**: 일별·월별·연도별 손익, 수익률(시간가중), 자산 증가율을 차트와 표로 보여 줍니다.
- **시장**: 코스피, 코스닥, 미국 주식. 미국 주식은 원화로 환산하며 **환율 변동까지 반영**합니다.

### 계산 방식

| 항목 | 방식 |
|---|---|
| 평균단가 / 실현손익 | 이동평균법. 수수료·세금은 매입원가에 포함하고, 매도 시에는 매도대금에서 뺍니다. |
| 미국 주식 원화 환산 | 매입원가는 **매수일 환율**, 평가금액은 **현재 환율**로 환산합니다. 그래서 환차손익도 손익에 들어갑니다. |
| 수익률 | 시간가중수익률(TWR). 추가 매수나 매도로 돈이 들어오고 나가는 효과를 뺀 순수 투자 성과입니다. |
| 자산 증가율 | (기말 평가금액 − 기초 평가금액) / 기초 평가금액. 추가 매수 금액까지 포함한 단순 증감률입니다. |
| 과거 자산 | 매매 기록과 일별 종가(DB 캐시)로 날마다 다시 계산하므로, 과거 기록을 입력해도 바로 반영됩니다. |

## 시세 데이터 (무료 API 비교)

| API | 코스피/코스닥 | 미국 | 환율 | 키 | 무료 한도 | 비고 |
|---|---|---|---|---|---|---|
| **Yahoo Finance (채택)** | O (`.KS`/`.KQ`) | O | O (`KRW=X`) | 불필요 | 비공식, 넉넉함 | 가장 대중적이며 한 곳에서 세 시장과 환율을 모두 제공합니다. 약 15~20분 지연. |
| 한국투자증권 KIS Open API | O | O | O | 필요 (계좌 개설) | 무료 | 실시간 시세가 가능하지만 계좌와 토큰 관리가 필요합니다. |
| 공공데이터포털 주식시세정보 | O | X | X | 필요 (무료) | 무료 | 하루 늦게(T+1) 제공되는 공식 종가입니다. |
| Alpha Vantage | 제한적 | O | O | 필요 | 하루 25회 | 한도가 매우 작습니다. |
| Finnhub | X (무료 플랜) | O | 유료 | 필요 | 분당 60회 | 미국 주식 위주입니다. |
| Twelve Data | 제한적 | O | O | 필요 | 하루 800회 | 한국 시장 커버리지가 약합니다. |

키 없이 세 시장과 환율을 모두 다룰 수 있는 **Yahoo Finance**를 기본으로 씁니다. 다만 비공식 API라 언제든 막힐 수 있습니다.
그래서 시세는 공급자 인터페이스(`src/lib/market/types.ts`) 뒤에 두었고, 다른 API는 `src/lib/market/`에 공급자를 추가해 바꿀 수 있습니다.
조회한 시세는 DB에 캐시합니다(현재가 10분, 일봉 6시간). 외부 API가 실패하면 마지막으로 저장된 값을 씁니다.

> 한글 종목명 검색은 Yahoo가 지원하지 않습니다. 종목코드(005930), 티커(AAPL), 영문명(Samsung)으로 검색하거나 직접 입력하세요.

## 기술 스택

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Prisma 6 + PostgreSQL · Auth.js 5 · Recharts · Vitest

## 로컬 실행

```bash
cp .env.example .env          # DATABASE_URL, AUTH_SECRET 입력
npm install
npm run db:migrate            # 테이블 생성
npm run db:seed               # (선택) 데모 계정 demo@donjo.app / demo1234
npm run dev                   # http://localhost:3000
```

시세 API에 접근할 수 없는 환경에서는 `MARKET_DATA_PROVIDER=mock`으로 가짜 시세를 써서 개발할 수 있습니다.

```bash
npm test        # 수익률 계산 단위 테스트
npm run lint
npm run build
```

## Vercel 배포

1. [vercel.com/new](https://vercel.com/new)에서 GitHub 저장소 `donjo`를 Import합니다. 프레임워크는 Next.js로 자동 인식됩니다.
2. 프로젝트의 **Storage** 탭에서 **Neon (Postgres)** 를 만들어 연결합니다(무료). 연결하면 `DATABASE_URL`이 자동으로 들어갑니다.
3. **Settings → Environment Variables**에 `AUTH_SECRET`을 추가합니다. 값은 `openssl rand -base64 32`로 만듭니다.
4. Redeploy합니다. 빌드할 때 `vercel-build` 스크립트가 `prisma migrate deploy`로 테이블을 자동으로 만듭니다.

Neon 대신 Supabase 같은 외부 Postgres를 쓰려면 2번 대신 `DATABASE_URL`을 직접 넣으면 됩니다.

## 웹앱(PWA)으로 설치

- **iPhone (Safari)**: 공유 버튼 → "홈 화면에 추가"
- **Android (Chrome)**: 메뉴 → "앱 설치" 또는 "홈 화면에 추가"
- **PC (Chrome/Edge)**: 주소창 오른쪽의 설치 아이콘

## 폴더 구조

```
prisma/schema.prisma      DB 스키마 (User, Account, Transaction, PriceBar, SymbolCache)
src/lib/portfolio.ts      보유·평균단가·실현손익 계산 (순수 함수)
src/lib/performance.ts    일별 자산 시계열, 일/월/년 수익률 (순수 함수)
src/lib/market/           시세 공급자 (yahoo, mock) + DB 캐시
src/app/actions.ts        서버 액션 (인증, 계좌, 매매 기록)
src/app/(app)/            대시보드, 계좌, 매매기록, 수익률 페이지
```
