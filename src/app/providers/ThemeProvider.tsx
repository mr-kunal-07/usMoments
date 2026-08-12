import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dim" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  isDarkTheme: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  cycleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEMES: readonly Theme[] = ["light", "dim", "dark"];

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("theme");
  return isTheme(saved) ? saved : getSystemTheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const followsSystemTheme = useRef(
    typeof window !== "undefined" && !isTheme(window.localStorage.getItem("theme")),
  );
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    followsSystemTheme.current = false;
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...THEMES);
    root.classList.add(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!followsSystemTheme.current) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setThemeState(getSystemTheme());
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const cycleTheme = useCallback(() => {
    followsSystemTheme.current = false;
    setThemeState((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme: theme === "light" ? "light" : "dark",
    isDarkTheme: theme !== "light",
    setTheme,
    toggleTheme: cycleTheme,
    cycleTheme,
  }), [cycleTheme, setTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
