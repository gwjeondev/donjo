"use client";

import { PASSWORD_RULES } from "@/lib/password";

/** 비밀번호 입력 중 조건 충족 여부를 보여 주는 체크리스트 */
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-live="polite">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.id} className={`flex items-center gap-1 ${ok ? "text-brand" : "text-muted"}`}>
            <span aria-hidden>{ok ? "✓" : "·"}</span>
            {r.label}
            <span className="sr-only">{ok ? " 충족" : " 미충족"}</span>
          </li>
        );
      })}
    </ul>
  );
}
