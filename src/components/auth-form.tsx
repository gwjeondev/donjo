"use client";

import Link from "next/link";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { login, register } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { state, pending, onSubmit } = useFormAction(mode === "login" ? login : register);
  return (
    <form method="post" onSubmit={onSubmit} className="card space-y-4 p-6">
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="name">이름 (선택)</label>
          <input id="name" name="name" className="input" autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : undefined}
          className="input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>
      {state.error && <p className="text-sm text-up">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
      </button>
      <p className="text-center text-sm text-ink-2">
        {mode === "login" ? (
          <>계정이 없나요? <Link href="/register" className="font-medium text-brand">회원가입</Link></>
        ) : (
          <>이미 계정이 있나요? <Link href="/login" className="font-medium text-brand">로그인</Link></>
        )}
      </p>
    </form>
  );
}
