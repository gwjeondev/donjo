import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if ((await auth())?.user) redirect("/dashboard");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/icons/icon-192.png" alt="" className="mx-auto mb-3 size-12 rounded-xl" />
          <h1 className="text-2xl font-bold">돈조</h1>
          <p className="mt-1 text-sm text-ink-2">계좌별 매매 기록과 수익률을 한눈에</p>
        </div>
        {children}
      </div>
    </main>
  );
}
