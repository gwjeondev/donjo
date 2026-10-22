"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AccountFilter({ accounts, value }: { accounts: { id: string; name: string }[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      className="input w-auto min-w-36"
      value={value ?? ""}
      aria-label="계좌 선택"
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set("account", e.target.value);
        else next.delete("account");
        router.push(`${pathname}?${next}`);
      }}
    >
      <option value="">전체 계좌</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}
