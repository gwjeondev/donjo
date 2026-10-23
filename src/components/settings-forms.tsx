"use client";

import { useRef } from "react";
import { changePassword, updateProfile } from "@/app/actions";
import { useFormAction } from "@/lib/hooks/use-form-action";

function Status({ state }: { state: { error?: string; message?: string } }) {
  if (state.error) return <p className="text-sm text-up">{state.error}</p>;
  if (state.message) return <p className="text-sm text-ink-2">{state.message}</p>;
  return null;
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const { state, pending, onSubmit } = useFormAction(updateProfile);
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          이메일
        </label>
        <input id="email" className="input text-muted" value={email} readOnly disabled />
      </div>
      <div>
        <label className="label" htmlFor="name">
          이름
        </label>
        <input id="name" name="name" className="input" defaultValue={name} maxLength={50} autoComplete="name" />
      </div>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction(async (prev, form) => {
    const res = await changePassword(prev, form);
    if (res.ok) ref.current?.reset();
    return res;
  });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="current">
          현재 비밀번호
        </label>
        <input id="current" name="current" type="password" className="input" required autoComplete="current-password" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="next">
            새 비밀번호 (8자 이상)
          </label>
          <input
            id="next"
            name="next"
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            새 비밀번호 확인
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            className="input"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      </div>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
