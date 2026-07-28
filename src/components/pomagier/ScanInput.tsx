import { type RefObject, useState, useRef, useCallback } from "react";
import { Package } from "lucide-react";

interface ScanInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  /** Visual mode: "scan" (green) or "locate" (blue) */
  mode: "scan" | "locate";
  totalQty: number;
}

interface Suggestion {
  code: string;
  name: string;
  barcode: string;
}

/**
 * Barcode scanner input with auto-complete suggestions.
 * Handles focus, debounced search, and mode-dependent styling.
 */
export function ScanInput({
  inputRef,
  inputValue,
  onInputChange,
  onSubmit,
  placeholder,
  mode,
  totalQty,
}: ScanInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback(
    (value: string) => {
      onInputChange(value);
      clearTimeout(searchTimeout.current);
      if (value.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      searchTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/products/quick-search?q=${encodeURIComponent(value.trim())}`,
          );
          const data = await res.json();
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
        } catch {
          setSuggestions([]);
        }
      }, 300);
    },
    [onInputChange],
  );

  const inputBorderClass =
    mode === "locate"
      ? "border-blue-400 focus:border-blue-500 focus:ring-blue-500/20"
      : "border-primary/40 focus:border-primary focus:ring-primary/20";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setShowSuggestions(false);
            onSubmit();
          }
        }}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full rounded-lg border-2 bg-background px-4 py-5 text-center text-lg font-mono shadow-inner outline-none transition-colors ${inputBorderClass}`}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border bg-card shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => {
                onInputChange(s.barcode || s.code);
                setShowSuggestions(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent touch-target border-b last:border-0"
            >
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs font-semibold truncate">
                  {s.barcode || s.code}
                </div>
                <div className="text-xs text-muted-foreground truncate">{s.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <p
        className="mt-1 text-center text-xs font-medium"
        style={{ color: mode === "locate" ? "#2563eb" : "#16a34a" }}
      >
        {mode === "scan"
          ? "🟢 Skanuj towary (Enter)"
          : `🔵 Koszyk: ${totalQty} szt. — zeskanuj lokalizację`}
      </p>
    </div>
  );
}
