import { useContext } from "react";
import { ThemeContext, type Theme } from "@/app/providers/ThemeProvider";

export type { Theme };

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("[useTheme] must be called inside <ThemeProvider>.");
  return context;
}
