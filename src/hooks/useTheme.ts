import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { readPref, writePref } from "../lib/prefs";

export type ThemePref = "system" | "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function systemDark(): boolean {
  return typeof window.matchMedia === "function" ? window.matchMedia(QUERY).matches : false;
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    const saved = readPref("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  });
  const osDark = useSyncExternalStore(subscribe, systemDark, () => false);
  const dark = pref === "system" ? osDark : pref === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    writePref("theme", p);
  }, []);

  return { pref, setPref, dark };
}
