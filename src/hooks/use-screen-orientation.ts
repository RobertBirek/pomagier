import { useState, useEffect, useCallback } from "react";

/**
 * Detects landscape orientation and attempts to lock to portrait.
 * Uses Screen Orientation API (requires PWA install for full effect).
 * Falls back to matchMedia detection when API is unavailable.
 */
export function useScreenOrientation() {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(orientation: landscape)").matches;
  });

  const lock = useCallback(async () => {
    try {
      const orient = screen.orientation as
        { lock?: (orientation: string) => Promise<void> } | undefined;
      if (orient?.lock) {
        await orient.lock("portrait");
      }
    } catch {
      // API may fail if not installed as PWA or permission denied.
      // We continue with matchMedia detection as fallback.
    }
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches);
      // Retry lock when orientation changes back to landscape
      if (e.matches) lock();
    };

    // Initial lock attempt on first user interaction proxy
    const attemptLock = () => {
      lock();
      document.removeEventListener("click", attemptLock);
      document.removeEventListener("touchend", attemptLock);
      document.removeEventListener("keydown", attemptLock);
    };
    document.addEventListener("click", attemptLock, { once: true });
    document.addEventListener("touchend", attemptLock, { once: true });
    document.addEventListener("keydown", attemptLock, { once: true });

    // Listen for orientation changes
    mql.addEventListener("change", handleChange);

    return () => {
      mql.removeEventListener("change", handleChange);
      document.removeEventListener("click", attemptLock);
      document.removeEventListener("touchend", attemptLock);
      document.removeEventListener("keydown", attemptLock);
    };
  }, [lock]);

  return { isLandscape, lock };
}
