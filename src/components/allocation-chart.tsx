"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmtKrw, fmtPct } from "@/lib/format";

export interface Slice {
  key: string;
  label: string;
  value: number;
}

const SLOTS = 7;
const color = (i: number) => (i < SLOTS ? `var(--series-${i + 1})` : "var(--series-other)");

/** 상위 7개 + 기타로 묶는다 (색은 정렬 순서가 아닌 항목 키 기준으로 고정) */
function fold(slices: Slice[]) {
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= SLOTS + 1) return sorted;
  const rest = sorted.slice(SLOTS);
  return [...sorted.slice(0, SLOTS), { key: "__other", label: `기타 ${rest.length}개`, value: rest.reduce((s, x) => s + x.value, 0) }];
}

export function AllocationChart({ groups }: { groups: { id: string; label: string; slices: Slice[] }[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id);
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  const data = fold(group?.slices ?? []);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">자산 비중</h2>
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupId(g.id)}
              className={`rounded-md px-2.5 py-1 font-medium ${g.id === group?.id ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-muted">데이터가 없습니다</p>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
          <div className="mx-auto h-44 w-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {data.map((d, i) => (
                    <Cell key={d.key} fill={color(d.key === "__other" ? SLOTS : i)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`${fmtKrw(v)} (${fmtPct(v / total, false)})`]}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }}
                  itemStyle={{ color: "var(--text)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-sm">
            {data.map((d, i) => (
              <li key={d.key} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: color(d.key === "__other" ? SLOTS : i) }} />
                <span className="min-w-0 flex-1 truncate text-ink-2">{d.label}</span>
                <span className="font-medium">{fmtPct(d.value / total, false)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
