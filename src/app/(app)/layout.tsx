import { logout } from "@/app/actions";
import { auth } from "@/auth";
import { LogoutIcon } from "@/components/icons";
import { BottomNav, SideNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencyProvider } from "@/components/currency";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const who = session.user.name || session.user.email;
  return (
    <div className="md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/icons/icon-192.png" alt="" className="size-8 rounded-lg" />
          <span className="text-lg font-bold">돈조</span>
        </div>
        <SideNav />
        <div className="mt-auto border-t border-line pt-4">
          <div className="mb-3"><ThemeToggle full /></div>
          <p className="truncate px-2 text-xs text-muted">{who}</p>
          <form action={logout}>
            <button className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              <LogoutIcon /> 로그아웃
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-x-clip">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="size-7 rounded-lg" />
            <span className="font-bold">돈조</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={logout}>
              <button className="p-1 text-ink-2" aria-label="로그아웃"><LogoutIcon /></button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          <CurrencyProvider>{children}</CurrencyProvider>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
