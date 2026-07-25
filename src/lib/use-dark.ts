import { useState, useEffect, useCallback } from "react";

export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("pomagier-dark");
    return stored ? stored === "1" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("pomagier-dark", dark ? "1" : "0");
  }, [dark]);

  const toggle = useCallback(() => setDark(d => !d), []);

  return [dark, toggle];
}
