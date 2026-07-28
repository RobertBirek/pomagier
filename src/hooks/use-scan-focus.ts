import { useRef, useEffect, useCallback } from "react";

/**
 * Manages auto-focus for barcode scanner input fields.
 * Only refocuses after specific interactions (scan, button press),
 * not on arbitrary touch/click events.
 */
export function useScanFocus() {
  const inputRef = useRef<HTMLInputElement>(null);

  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Initial focus on mount
  useEffect(() => {
    refocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { inputRef, refocus };
}
