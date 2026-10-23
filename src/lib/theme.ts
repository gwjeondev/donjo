// 테마 설정: light | dark | system. 기기(브라우저)별로 localStorage에 저장한다.
export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "donjo-theme";

const BAR_COLOR = { light: "#f5f5f3", dark: "#111110" } as const;

/** 첫 화면을 그리기 전에 실행해 깜빡임을 막는 인라인 스크립트 */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;

  // 모바일 브라우저 상단바 색도 선택한 테마에 맞춘다
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.dataset.media ??= m.media;
    if (pref === "system") {
      m.media = m.dataset.media;
      m.content = m.dataset.media.includes("dark") ? BAR_COLOR.dark : BAR_COLOR.light;
    } else {
      m.media = "";
      m.content = BAR_COLOR[pref];
    }
  });

  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* 저장 불가(사생활 보호 모드 등): 이번 화면에만 적용 */
  }
}
