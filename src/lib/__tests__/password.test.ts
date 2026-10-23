import { describe, expect, it } from "vitest";
import { passwordProblem } from "../password";

describe("passwordProblem", () => {
  it("영문+숫자+특수문자 8자 이상이면 통과 (대소문자 무관)", () => {
    expect(passwordProblem("abcd123!")).toBeNull();
    expect(passwordProblem("ABCD123!")).toBeNull();
    expect(passwordProblem("돈조abc12#")).toBeNull();
  });
  it("부족한 조건을 알려 준다", () => {
    expect(passwordProblem("abc12!")).toContain("8자 이상으로 입력하세요 (부족: 8자 이상)");
    expect(passwordProblem("password123")).toContain("부족: 특수문자");
    expect(passwordProblem("12345678!")).toContain("부족: 영문");
    expect(passwordProblem("abcdefg!")).toContain("부족: 숫자");
  });
  it("공백은 허용하지 않는다", () => {
    expect(passwordProblem("abc 123!x")).toContain("공백");
  });
});
