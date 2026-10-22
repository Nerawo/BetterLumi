import { db } from "./domain";
export const themeOptions = [
  {
    id: "misty",
    name: "themeMisty",
    color: "#72899A",
    bg: "#F4F2ED",
    surface: "#FFFEFA",
    ink: "#34434D",
    soft: "#E2E9ED",
    line: "#D9DEDF",
    muted: "#596B77",
    action: "#455F70",
    warm: "#C5A68F",
  },
  {
    id: "apricot",
    name: "themeApricot",
    color: "#B87E6B",
    bg: "#F8F1E9",
    surface: "#FFFDF8",
    ink: "#493C37",
    soft: "#F2DED3",
    line: "#E5D5CB",
    muted: "#796156",
    action: "#895341",
    warm: "#C5A68F",
  },
  {
    id: "lavender",
    name: "themeLavender",
    color: "#9586A8",
    bg: "#F5F2F6",
    surface: "#FFFDFE",
    ink: "#443F4D",
    soft: "#EAE4F0",
    line: "#DED7E4",
    muted: "#70637E",
    action: "#6E5B84",
    warm: "#C5A68F",
  },
  {
    id: "olive",
    name: "themeOlive",
    color: "#68745A",
    bg: "#F0F0E8",
    surface: "#FAFAF5",
    ink: "#2E392E",
    soft: "#DCE1D2",
    line: "#D7DBCE",
    muted: "#65705E",
    action: "#526047",
    warm: "#C5A68F",
  },
] as const;
export function resolvedTheme(value?: string) {
  return themeOptions.find((t) => t.id === value) ?? themeOptions[0];
}
export function applyTheme(value?: string) {
  const theme = resolvedTheme(value);
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  const tokens = {
    bg: theme.bg,
    surface: theme.surface,
    ink: theme.ink,
    olive: theme.color,
    soft: theme.soft,
    line: theme.line,
    muted: theme.muted,
    action: theme.action,
    warm: theme.warm,
  };
  for (const [key, color] of Object.entries(tokens))
    root.style.setProperty("--" + key, color);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme.bg);
}
export async function chooseTheme(id: string) {
  const theme = resolvedTheme(id);
  await db.settings.put({ key: "theme", value: theme.id });
  applyTheme(theme.id);
}
