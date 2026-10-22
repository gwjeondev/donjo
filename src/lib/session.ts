import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** 로그인된 사용자 ID. 미로그인 시 로그인 페이지로 이동 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}
