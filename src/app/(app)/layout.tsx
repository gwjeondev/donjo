import { logout } from "@/app/actions";
import { auth } from "@/auth";
import Link from "next/link";
import { InfoIcon, LogoutIcon, SettingsIcon } from "@/components/icons";
import { BottomNav, SideNav } from "@/components/nav";
import { PageBack } from "@/components/back-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencyProvider } from "@/components/currency";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // 이름은 설정에서 바뀔 수 있어 세션 대신 DB에서 읽는다 (없으면 이메일)
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true } });
  const displayName = user?.name || user?.email || session.user.email;
  return (
    <div className="md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <Link data-nav-root href="/dashboard" className="mb-6 flex items-center gap-2 px-2" aria-label="대시보드로">
          <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
          <span className="text-lg font-bold">돈조</span>
        </Link>
        <SideNav />
        <div className="mt-auto border-t border-line pt-4">
          <div className="mb-3"><ThemeToggle full /></div>
          <Link data-nav-root href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
            <SettingsIcon /> <span className="min-w-0 flex-1 truncate">설정</span>
          </Link>
          <p className="mt-1 truncate px-3 text-xs text-muted">{displayName}</p>
          <form action={logout}>
            <button className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              <LogoutIcon /> 로그아웃
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-x-clip">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur md:hidden">
          <Link data-nav-root href="/dashboard" className="flex items-center gap-2" aria-label="대시보드로">
            <img src="/icons/icon-192.png" alt="" className="size-7 rounded-lg" />
            <span className="font-bold">돈조</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link data-nav-root href="/settings" className="p-1 text-ink-2" aria-label="설정" title="설정">
              <SettingsIcon />
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          <PageBack />
          <CurrencyProvider>{children}</CurrencyProvider>
          {/* 모든 화면 맨 아래: 서비스 소개 바로가기 (PC·모바일 같은 위치) */}
          <footer className="mt-12 flex justify-center">
            <Link href="/about" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand">
              <InfoIcon className="size-3.5" /> 돈조
            </Link>
          </footer>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
