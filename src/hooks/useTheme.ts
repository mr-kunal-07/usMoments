import { useState, useEffect } from "react";

export type Theme = "light" | "dim" | "dark";

const getSystemTheme = (): Theme => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") as Theme | null;
      if (saved === "light" || saved === "dim" || saved === "dark") return saved;

      return getSystemTheme();
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light", "dim", "dark");
    root.classList.add(theme);

    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");

    if (saved === "light" || saved === "dim" || saved === "dark") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      setThemeState(getSystemTheme());
    };

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  const cycleTheme = () => {
    setThemeState((current) => {
      if (current === "light") return "dim";
      if (current === "dim") return "dark";
      return "light";
    });
  };

  const toggleTheme = () => {
    cycleTheme();
  };

  return {
    theme,
    resolvedTheme: theme === "light" ? "light" : "dark",
    isDarkTheme: theme === "dim" || theme === "dark",
    setTheme: setThemeState,
    toggleTheme,
    cycleTheme,
  };
}
