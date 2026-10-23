// 비밀번호 규칙: 영문 + 숫자 + 특수문자를 각각 1개 이상, 8자 이상 (대소문자 구분 없음)
export const PASSWORD_RULES = [
  { id: "length", label: "8자 이상", test: (p: string) => p.length >= 8 },
  { id: "letter", label: "영문", test: (p: string) => /[A-Za-z]/.test(p) },
  { id: "digit", label: "숫자", test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "특수문자", test: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
] as const;

export const PASSWORD_HINT = "영문, 숫자, 특수문자를 섞어 8자 이상";

/** 규칙을 어기면 안내 문구, 통과하면 null */
export function passwordProblem(p: string): string | null {
  if (/\s/.test(p)) return "비밀번호에 공백은 쓸 수 없습니다";
  if (p.length > 72) return "비밀번호는 72자 이하로 입력하세요";
  const missing = PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.label);
  return missing.length ? `비밀번호는 ${PASSWORD_HINT}으로 입력하세요 (부족: ${missing.join(", ")})` : null;
}
