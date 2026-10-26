// Appearance: light, night, or follow the device. Applied before the first
// render (imported from main.tsx) so the screen never flashes white at 3 a.m.
// The preference lives in localStorage like the language: optional, and a
// denied storage must never block boot.

export const THEME_PREFS = ["system", "light", "dark"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];

const KEY = "owly-theme";
const THEME_COLOR = { light: "#f9f8f7", dark: "#1d1c1a" } as const;

const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (THEME_PREFS as readonly string[]).includes(v)) return v as ThemePref;
  } catch { /* denied — follow the device */ }
  return "system";
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && !!media?.matches);
  const mode = dark ? "dark" : "light";
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[mode]);
}

export function setThemePref(pref: ThemePref): void {
  try { localStorage.setItem(KEY, pref); } catch { /* denied — session-only */ }
  apply(pref);
}

apply(getThemePref());
media?.addEventListener("change", () => apply(getThemePref()));
