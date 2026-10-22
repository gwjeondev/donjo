"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/app/actions";

/**
 * useActionState + onSubmit. React 19의 <form action>은 제출 후 입력값을 초기화해서
 * 검증 오류가 나면 사용자가 입력한 값이 사라지므로, 직접 제출해 입력값을 유지한다.
 */
export function useFormAction(fn: (state: FormState, form: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(fn, {});
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit };
}
