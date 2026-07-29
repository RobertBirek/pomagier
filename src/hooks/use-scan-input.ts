import { useState, useRef, useEffect, useCallback } from "react";

interface UseScanInputOptions {
  onSubmit: (code: string) => Promise<boolean>;
  hint: string;
}

interface UseScanInputReturn {
  value: string;
  setValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  handleChange: (v: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  clear: () => void;
}

export function useScanInput({ onSubmit, hint }: UseScanInputOptions): UseScanInputReturn {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef(0);
  const wedgeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const submitting = useRef(false);

  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    refocus();
  }, []);

  const clear = useCallback(() => {
    setValue("");
    clearTimeout(wedgeTimer.current);
    refocus();
  }, [refocus]);

  const submitCode = useCallback(
    async (code: string) => {
      if (!code || submitting.current) return;
      submitting.current = true;
      clearTimeout(wedgeTimer.current);
      try {
        await onSubmit(code);
      } finally {
        submitting.current = false;
        setValue("");
        refocus();
      }
    },
    [onSubmit, refocus],
  );

  const handleChange = useCallback(
    (newValue: string) => {
      setValue(newValue);

      const now = Date.now();
      const gap = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (gap < 30 && gap > 0) {
        clearTimeout(wedgeTimer.current);
        wedgeTimer.current = setTimeout(() => {
          const code = newValue.trim();
          if (!code || submitting.current) return;
          submitCode(code);
        }, 150);
      }
    },
    [submitCode],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitCode(value.trim());
      }
    },
    [submitCode, value],
  );

  return { value, setValue, inputRef, handleChange, handleKeyDown, clear };
}
