import { useState, useEffect, useCallback } from "react";

const RECENT_KEY_PREFIX = "pomagier-recent";

function loadRecent(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${RECENT_KEY_PREFIX}-${userId}`);
    if (!raw) return [];
    const parsed: { codes: string[]; savedAt: number } = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > 8 * 60 * 60 * 1000) return [];
    return parsed.codes;
  } catch {
    return [];
  }
}

function saveRecent(userId: string, codes: string[]) {
  try {
    if (codes.length === 0) {
      localStorage.removeItem(`${RECENT_KEY_PREFIX}-${userId}`);
    } else {
      localStorage.setItem(
        `${RECENT_KEY_PREFIX}-${userId}`,
        JSON.stringify({ codes, savedAt: Date.now() }),
      );
    }
  } catch {
    /* storage unavailable */
  }
}

export function useRecentCodes(userId: string | undefined) {
  const [recentCodes, setRecentCodes] = useState<string[]>(() =>
    userId ? loadRecent(userId) : [],
  );

  useEffect(() => {
    if (userId) {
      saveRecent(userId, recentCodes);
    }
  }, [recentCodes, userId]);

  const addRecentCode = useCallback((code: string) => {
    setRecentCodes((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, 10);
      return next;
    });
  }, []);

  const clearRecentCodes = useCallback(() => {
    setRecentCodes([]);
  }, []);

  return { recentCodes, addRecentCode, clearRecentCodes } as const;
}
