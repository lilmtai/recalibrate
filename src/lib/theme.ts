/** Light / dark / auto (follow the phone). Saved per device. */
export type Theme = "auto" | "light" | "dark";
const KEY = "recalibrate.theme";
const BAR = { light: "#f6f6f7", dark: "#0b0b0c" };

export function getTheme(): Theme {
  try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "auto"; } catch { return "auto"; }
}

/** Set `data-theme` on <html> (CSS reads it) and the phone's top-bar colour. */
export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const forDark = (m.media || "").includes("dark");
    m.content = t === "auto" ? (forDark ? BAR.dark : BAR.light) : BAR[t];
  });
}

export function setTheme(t: Theme) {
  try { if (t === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
}
