import { useState, useCallback } from "react";

const LAST_LOC_KEY = "pomagier-last-location";

export function useLocationMemory() {
  const [lastLocation, setLastLocation] = useState<string | null>(() =>
    localStorage.getItem(LAST_LOC_KEY),
  );

  const remember = useCallback((code: string) => {
    setLastLocation(code);
    localStorage.setItem(LAST_LOC_KEY, code);
  }, []);

  return { lastLocation, remember };
}
