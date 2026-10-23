import { ExportButton } from "@/components/csv-actions";
import { LocalizeNamesButton } from "@/components/localize-names";
import { PageHeader } from "@/components/page-header";
import { PasswordForm, ProfileForm } from "@/components/settings-forms";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { logout } from "@/app/actions";
import { LogoutIcon } from "@/components/icons";

export const metadata = { title: "설정" };

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-ink-2">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } });
  return (
    // 읽기 좋은 폭으로 줄이되, 화면(및 맨 아래 바로가기) 기준 가운데에 둔다
    <div className="mx-auto max-w-2xl">
      <PageHeader title="설정" />
      <div className="space-y-4">
        <Section title="프로필">
          <ProfileForm name={user.name ?? ""} email={user.email} />
        </Section>
        <Section title="비밀번호 변경">
          <PasswordForm />
        </Section>
        <Section title="화면 테마" desc="이 기기에만 적용돼요.">
          <div className="max-w-xs">
            <ThemeToggle full />
          </div>
        </Section>
        <Section
          title="종목 이름"
          desc="국내 종목은 증권사(네이버 증권) 표기 이름으로 자동으로 바뀌어요. 직접 바꾼 한글 이름은 유지되며, 아래 버튼을 누르면 그것까지 모두 공식 이름으로 맞춰요."
        >
          <LocalizeNamesButton />
        </Section>
        <Section
          title="데이터 백업"
          desc="모든 매매 기록을 CSV 파일로 받아요. 매매기록 화면의 '가져오기'로 다시 불러올 수 있어요."
        >
          <ExportButton compact={false} />
        </Section>
        {/* 로그아웃: PC는 사이드바에 있어 모바일에서만 보인다 */}
        <form action={logout} className="md:hidden">
          <button className="btn-ghost w-full sm:w-auto">
            <LogoutIcon className="size-4" /> 로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
