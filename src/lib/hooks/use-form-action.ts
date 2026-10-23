"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, type FormEvent } from "react";
import type { FormState } from "@/app/actions";

/**
 * useActionState + onSubmit.
 * - React 19의 <form action>은 제출 후 입력값을 초기화해서, 검증 오류가 나면 입력값이 사라지므로 직접 제출한다.
 * - 저장에 성공하면 응답을 다 받은 뒤 화면을 따로 새로 그린다 (액션 안에서 다시 그리면 응답이 끊겨 멈출 수 있음).
 */
export function useFormAction(fn: (state: FormState, form: FormData) => Promise<FormState>) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState<FormState, FormData>(fn, {});
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit };
}
