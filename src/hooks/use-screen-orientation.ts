import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Aggressive portrait lock. Uses Screen Orientation API to physically
 * prevent device rotation. Falls back to landscape detection + overlay
 * only when the API is completely unsupported.
 */
export function useScreenOrientation() {
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(orientation: landscape)").matches;
  });
  const [unsupported, setUnsupported] = useState(false);
  const lockedRef = useRef(false);

  const lock = useCallback(async (): Promise<boolean> => {
    try {
      const s = screen as { orientation?: { lock?: (o: string) => Promise<void> } };
      if (s.orientation?.lock) {
        await s.orientation.lock("portrait");
        lockedRef.current = true;
        setIsLandscape(false);
        return true;
      }
    } catch {
      // May fail without PWA or user gesture
    }
    return false;
  }, []);

  useEffect(() => {
    let reLockTimer: ReturnType<typeof setInterval> | null = null;

    // 1. Try immediate lock
    lock().then((ok) => {
      if (!ok) setUnsupported(true);
    });

    // 2. matchMedia listener + aggressive re-lock when landscape
    const mql = window.matchMedia("(orientation: landscape)");
    const handleMqlChange = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches);
      if (e.matches) {
        lock();
        // Aggressive re-lock every 2s until portrait
        if (!reLockTimer) {
          reLockTimer = setInterval(() => {
            if (window.matchMedia("(orientation: landscape)").matches) {
              lock();
            } else {
              setIsLandscape(false);
              if (reLockTimer) {
                clearInterval(reLockTimer);
                reLockTimer = null;
              }
            }
          }, 2000);
        }
      } else {
        setIsLandscape(false);
        if (reLockTimer) {
          clearInterval(reLockTimer);
          reLockTimer = null;
        }
      }
    };
    mql.addEventListener("change", handleMqlChange);

    // 3. Retry lock on user interaction (gesture-required browsers)
    const retryOnInteraction = () => {
      if (!lockedRef.current) lock();
      document.removeEventListener("click", retryOnInteraction);
      document.removeEventListener("touchend", retryOnInteraction);
      document.removeEventListener("keydown", retryOnInteraction);
    };
    document.addEventListener("click", retryOnInteraction);
    document.addEventListener("touchend", retryOnInteraction);
    document.addEventListener("keydown", retryOnInteraction);

    return () => {
      if (reLockTimer) clearInterval(reLockTimer);
      mql.removeEventListener("change", handleMqlChange);
      document.removeEventListener("click", retryOnInteraction);
      document.removeEventListener("touchend", retryOnInteraction);
      document.removeEventListener("keydown", retryOnInteraction);
    };
  }, [lock]);

  return { isLandscape, unsupported, lock };
}
