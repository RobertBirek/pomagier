import { useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Keyboard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ScanLine,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./primitives";

export type ScanResult = {
  code: string;
  ok: boolean;
  label: string;
  kind: "ok" | "unknown" | "duplicate" | "wrong";
};

export type ScanAction = {
  label: string;
  code: string;
  kind: ScanResult["kind"];
  variant?: "primary" | "outline";
};

export function ScanPanel({
  hint = "Zeskanuj kod kreskowy lub EAN",
  onScan,
  expectedCode,
  customActions,
  scannerSlot,
}: {
  hint?: string;
  onScan?: (r: ScanResult) => void;
  expectedCode?: string;
  customActions?: ScanAction[];
  scannerSlot?: React.ReactNode;
}) {
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [manual, setManual] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  const emit = (r: ScanResult) => {
    setHistory((h) => [r, ...h].slice(0, 5));
    onScan?.(r);
    const map = {
      ok: toast.success,
      unknown: toast.error,
      duplicate: toast.warning,
      wrong: toast.error,
    } as const;
    map[r.kind](r.label, { description: r.code });
  };

  const actions = customActions ?? [
    {
      label: "Symuluj poprawny skan",
      code: expectedCode ?? "5901234123457",
      kind: "ok" as const,
      variant: "primary" as const,
    },
    { label: "Nieznany kod", code: "0000000000000", kind: "unknown" as const },
    { label: "Duplikat", code: expectedCode ?? "5901234123457", kind: "duplicate" as const },
    { label: "Zły produkt", code: "5999999999999", kind: "wrong" as const },
  ];

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-col items-center">
        <div className="relative flex h-40 w-full max-w-sm items-center justify-center rounded-lg bg-background/80 shadow-inner">
          {scannerSlot ? (
            scannerSlot
          ) : (
            <>
              <ScanLine className="h-12 w-12 text-primary/50 animate-pulse" />
              <div className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-primary/60" />
              <div className="absolute inset-y-4 left-4 w-8 border-l-2 border-t-2 border-primary" />
              <div className="absolute inset-y-4 right-4 w-8 border-r-2 border-t-2 border-primary" />
            </>
          )}
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">{hint}</p>
        <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-2">
          {actions.map((a, i) => (
            <button
              key={i}
              className={cn(
                "touch-target rounded-md px-3 py-2 text-sm",
                a.variant === "primary"
                  ? "bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                  : "border bg-background hover:bg-accent",
              )}
              onClick={() =>
                emit({ code: a.code, ok: a.kind === "ok", label: a.label, kind: a.kind })
              }
            >
              {a.variant === "primary" && <Camera className="mr-1 inline h-4 w-4" />}
              {a.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setManualOpen((v) => !v)}
          className="mt-3 text-xs text-muted-foreground underline"
        >
          <Keyboard className="mr-1 inline h-3 w-3" /> Wpisz kod ręcznie
        </button>
        {manualOpen && (
          <div className="mt-2 flex w-full max-w-md gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="np. 5901234123457"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                if (!manual) return;
                emit({ code: manual, ok: true, label: "Wprowadzono ręcznie", kind: "ok" });
                setManual("");
              }}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Zatwierdź
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ostatnie skany
            </span>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1 inline h-3 w-3" /> Wyczyść
            </button>
          </div>
          <ul className="space-y-1">
            {history.map((h, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5 text-xs"
              >
                <span className="mono">{h.code}</span>
                <ScanTag kind={h.kind} label={h.label} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ScanTag({ kind, label }: { kind: ScanResult["kind"]; label: string }) {
  const map = {
    ok: { tone: "success" as const, Icon: CheckCircle2 },
    unknown: { tone: "danger" as const, Icon: XCircle },
    duplicate: { tone: "warning" as const, Icon: AlertTriangle },
    wrong: { tone: "danger" as const, Icon: XCircle },
  };
  const { tone, Icon } = map[kind];
  return (
    <StatusBadge tone={tone} icon={<Icon className="h-3 w-3" />}>
      {label}
    </StatusBadge>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max,
  unit = "szt",
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  unit?: string;
}) {
  const set = (n: number) => onChange(Math.max(0, max != null ? Math.min(max, n) : n));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => set(value - 1)}
          className="touch-target flex-1 rounded-md border bg-background text-2xl font-bold hover:bg-accent"
        >
          −
        </button>
        <div className="w-28 text-center">
          <div className="text-3xl font-bold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{unit}</div>
        </div>
        <button
          onClick={() => set(value + 1)}
          className="touch-target flex-1 rounded-md border bg-background text-2xl font-bold hover:bg-accent"
        >
          +
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => set(value + 1)}
          className="touch-target rounded-md bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20"
        >
          +1
        </button>
        <button
          onClick={() => set(value + 5)}
          className="touch-target rounded-md bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20"
        >
          +5
        </button>
        {max != null && (
          <button
            onClick={() => set(max)}
            className="touch-target rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Pełna ({max})
          </button>
        )}
      </div>
    </div>
  );
}

export function PinPad({
  onSubmit,
  maxLength = 4,
}: {
  onSubmit: (pin: string) => void;
  maxLength?: number;
}) {
  const [pin, setPin] = useState("");
  const push = (d: string) => setPin((p) => (p.length >= maxLength ? p : p + d));
  const del = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="mx-auto w-full max-w-xs">
      <div className="mb-4 flex justify-center gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2",
              i < pin.length ? "border-primary bg-primary" : "border-border bg-background",
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => push(d)}
            className="touch-target h-16 rounded-lg border bg-card text-2xl font-semibold shadow-sm hover:bg-accent"
          >
            {d}
          </button>
        ))}
        <button
          onClick={del}
          className="touch-target h-16 rounded-lg border bg-card text-sm font-medium hover:bg-accent"
        >
          ⌫
        </button>
        <button
          onClick={() => push("0")}
          className="touch-target h-16 rounded-lg border bg-card text-2xl font-semibold hover:bg-accent"
        >
          0
        </button>
        <button
          onClick={() => pin.length >= maxLength && onSubmit(pin)}
          disabled={pin.length < maxLength}
          className="touch-target h-16 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export function TerminalFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[400px] rounded-[2.5rem] border-8 border-slate-800 bg-slate-800 p-2 shadow-2xl">
      <div className="relative h-[780px] w-full overflow-hidden rounded-[2rem] bg-background">
        <div className="absolute left-1/2 top-2 z-30 h-4 w-24 -translate-x-1/2 rounded-full bg-slate-800" />
        <div className="h-full w-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
