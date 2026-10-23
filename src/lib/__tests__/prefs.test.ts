import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, readPrefs, sortBy } from "../prefs";

describe("prefs", () => {
  it("비어 있거나 잘못된 값은 기본값으로 읽는다", () => {
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(readPrefs({ accounts: { key: "nope", dir: "up" }, trades: 3 })).toEqual(DEFAULT_PREFS);
    expect(readPrefs({ holdings: { key: "returnRate", dir: "asc" }, trades: "old" })).toEqual({
      ...DEFAULT_PREFS,
      holdings: { key: "returnRate", dir: "asc" },
      trades: "old",
    });
  });

  it("숫자·한글 정렬, 같은 값은 원래 순서 유지", () => {
    const xs = [{ n: "하나", v: 2 }, { n: "가", v: 5 }, { n: "다", v: 2 }];
    expect(sortBy(xs, (x) => x.v, "desc").map((x) => x.n)).toEqual(["가", "하나", "다"]);
    expect(sortBy(xs, (x) => x.v, "asc").map((x) => x.n)).toEqual(["하나", "다", "가"]);
    expect(sortBy(xs, (x) => x.n, "asc").map((x) => x.n)).toEqual(["가", "다", "하나"]);
  });
});
