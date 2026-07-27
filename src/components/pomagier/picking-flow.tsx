import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ScanPanel, QuantityStepper, type ScanResult } from "./scan";
import { StatusBadge } from "./primitives";
import { useDemo } from "@/lib/demo-state";
import { tasks, pickingPositions, type PickingPosition, type Task } from "@/lib/mock-data";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Package,
  Home,
  ChevronRight,
  SkipForward,
  RotateCcw,
  Pause,
  Play,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type View =
  "list" | "summary" | "location" | "product" | "quantity" | "position-done" | "task-summary";

export function PickingFlow({ initialTaskId }: { initialTaskId?: string }) {
  const { bumpPendingSync } = useDemo();
  const [taskId, setTaskId] = useState<string | null>(initialTaskId ?? null);
  const [view, setView] = useState<View>(initialTaskId ? "summary" : "list");
  const [positions, setPositions] = useState<PickingPosition[]>(() =>
    pickingPositions.map((p) => ({ ...p, status: "pending" })),
  );
  const [index, setIndex] = useState(0);
  const [scanLog, setScanLog] = useState<ScanResult[]>([]);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);

  const task = taskId ? tasks.find((t) => t.id === taskId) : null;
  const pos = positions[index];
  const doneCount = positions.filter((p) => p.status !== "pending").length;
  const pickedCount = positions.filter((p) => p.status === "picked").length;
  const shortCount = positions.filter((p) => p.status === "short").length;
  const skippedCount = positions.filter((p) => p.status === "skipped").length;

  const startTask = (id: string) => {
    setTaskId(id);
    setPositions(pickingPositions.map((p) => ({ ...p, status: "pending" })));
    setIndex(0);
    setScanLog([]);
    setError(null);
    setView("summary");
  };

  const reset = () => {
    setTaskId(null);
    setView("list");
    setPositions(pickingPositions.map((p) => ({ ...p, status: "pending" })));
    setIndex(0);
    setScanLog([]);
    setError(null);
  };

  const goBack = () => {
    if (view === "summary") {
      reset();
      return;
    }
    if (view === "location") {
      setView("summary");
      return;
    }
    if (view === "product") {
      setView("location");
      return;
    }
    if (view === "quantity") {
      setView("product");
      return;
    }
    if (view === "position-done") {
      setView("quantity");
      return;
    }
    if (view === "task-summary") {
      setView(view);
    }
  };

  const logScan = (r: ScanResult) => setScanLog((s) => [r, ...s].slice(0, 10));

  const handleLocationScan = (r: ScanResult) => {
    logScan(r);
    if (!pos) return;
    const valid = [pos.location, pos.alternativeLocation].filter(Boolean);
    if (r.ok && valid.includes(r.code)) {
      setError(null);
      setView("product");
      return;
    }
    if (r.kind === "wrong") {
      setError({
        title: "Nieprawidłowa lokalizacja",
        description: `Oczekiwano ${pos.location}, zeskanowano ${r.code}.`,
      });
      return;
    }
    setError({
      title: "Nie rozpoznano lokalizacji",
      description: `Kod ${r.code} nie pasuje do lokalizacji ${pos.location}.`,
    });
  };

  const handleProductScan = (r: ScanResult) => {
    logScan(r);
    if (!pos) return;
    if (r.ok && r.code === pos.ean) {
      setError(null);
      setView("quantity");
      return;
    }
    if (r.kind === "duplicate") {
      setError({
        title: "Duplikat skanu",
        description: "Ten kod został już zeskanowany w bieżącej sesji.",
      });
      return;
    }
    if (r.kind === "wrong") {
      setError({
        title: "Zły produkt",
        description: `Zeskanowano ${r.code}, oczekiwano ${pos.ean} (${pos.productCode}).`,
      });
      return;
    }
    setError({ title: "Nieznany kod", description: `Kod ${r.code} nie istnieje w zadaniu.` });
  };

  const finishPosition = (qty: number, status: "picked" | "short" | "skipped") => {
    setPositions((arr) => arr.map((p, i) => (i === index ? { ...p, picked: qty, status } : p)));
    bumpPendingSync();
    if (status === "picked") toast.success(`Pobrano ${qty} ${pos.unit}`);
    if (status === "short") toast.warning(`Zgłoszono brak: ${qty}/${pos.required} ${pos.unit}`);
    if (status === "skipped") toast.info("Pozycja pominięta");
    setView("position-done");
  };

  const nextPosition = () => {
    if (index + 1 >= positions.length) setView("task-summary");
    else {
      setIndex((i) => i + 1);
      setView("location");
      setError(null);
    }
  };

  const completeTask = () => {
    toast.success(`Zadanie ${task?.id} zakończone — wysłano do synchronizacji`);
    reset();
  };

  const pauseTask = () => {
    toast.info("Zadanie wstrzymane. Możesz do niego wrócić z listy zadań.");
    reset();
  };

  if (view === "list") {
    const pickingTasks = tasks.filter(
      (t) => t.type === "Kompletacja" && t.status !== "Zakończone" && t.status !== "Anulowane",
    );
    return (
      <div className="p-3 space-y-3">
        <h1 className="text-lg font-semibold">Zadania kompletacji</h1>
        <ul className="space-y-2">
          {pickingTasks.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => startTask(t.id)}
                className="touch-target w-full rounded-lg border bg-card p-3 text-left active:scale-95 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="mono font-semibold">{t.id}</div>
                  <StatusBadge
                    tone={
                      t.priority === "Wysoki"
                        ? "warning"
                        : t.priority === "Krytyczny"
                          ? "danger"
                          : "muted"
                    }
                  >
                    {t.priority}
                  </StatusBadge>
                </div>
                <div className="mono mt-1 text-xs text-muted-foreground">{t.docNumber}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>
                    {t.positions} pozycji · {t.warehouse}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            </li>
          ))}
        </ul>
        <Link
          to="/mobile/dashboard"
          className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Home className="h-4 w-4" /> Powrót do dashboardu
        </Link>
      </div>
    );
  }

  if (view === "summary" && task) {
    return (
      <div className="p-3 space-y-3">
        <h1 className="text-lg font-semibold">{task.id}</h1>
        <div className="rounded-lg border bg-card p-3 text-sm space-y-1">
          <Row k="Dokument" v={<span className="mono">{task.docNumber}</span>} />
          <Row k="Magazyn" v={<span className="mono">{task.warehouse}</span>} />
          <Row k="Pozycje" v={`${positions.length}`} />
          <Row
            k="Priorytet"
            v={
              <StatusBadge tone={task.priority === "Wysoki" ? "warning" : "muted"}>
                {task.priority}
              </StatusBadge>
            }
          />
          <Row k="SLA" v={task.sla} />
        </div>
        <div className="rounded-lg border bg-primary/5 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Pierwsza lokalizacja
          </div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="mono">{positions[0].location}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="touch-target flex-1 rounded-md border bg-background text-sm font-medium"
          >
            Anuluj
          </button>
          <button
            onClick={() => setView("location")}
            className="touch-target flex-[2] rounded-md bg-primary text-sm font-semibold text-primary-foreground"
          >
            Rozpocznij kompletację
          </button>
        </div>
      </div>
    );
  }

  if (view === "location" && pos) {
    return (
      <div className="p-3 space-y-3">
        <ProgressHeader current={doneCount + 1} total={positions.length} />
        <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 text-center">
          <div className="text-xs font-medium uppercase text-muted-foreground">
            Idź do lokalizacji
          </div>
          <div className="mono mt-2 text-4xl font-black text-primary">{pos.location}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Strefa {pos.location.split("-")[0]}
          </div>
          {pos.alternativeLocation && (
            <div className="mt-2 text-xs text-muted-foreground">
              Alt.: <span className="mono">{pos.alternativeLocation}</span>
            </div>
          )}
        </div>
        {error && (
          <ErrorBox
            title={error.title}
            description={error.description}
            onDismiss={() => setError(null)}
          />
        )}
        <ScanPanel
          hint="Zeskanuj kod lokalizacji"
          onScan={handleLocationScan}
          customActions={[
            { label: "Poprawna lokalizacja", code: pos.location, kind: "ok", variant: "primary" },
            {
              label: "Alt. lokalizacja",
              code: pos.alternativeLocation ?? pos.location,
              kind: "ok",
            },
            { label: "Zła lokalizacja", code: "A-99-99-99", kind: "wrong" },
            { label: "Nieznany kod", code: "UNKNOWN", kind: "unknown" },
          ]}
        />
        <div className="flex gap-2">
          <button
            onClick={goBack}
            className="touch-target flex-1 rounded-md border bg-background text-sm font-medium"
          >
            Wstecz
          </button>
          <button
            onClick={pauseTask}
            className="touch-target flex-1 rounded-md border bg-background text-sm font-medium"
          >
            <Pause className="mr-1 inline h-4 w-4" /> Wstrzymaj
          </button>
        </div>
      </div>
    );
  }

  if (view === "product" && pos) {
    return (
      <div className="p-3 space-y-3">
        <ProgressHeader current={doneCount + 1} total={positions.length} />
        <div className="rounded-lg border bg-card p-3">
          <div className="flex gap-3">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md bg-muted">
              <Package className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mono text-xs text-muted-foreground">{pos.productCode}</div>
              <div className="truncate text-base font-semibold">{pos.productName}</div>
              <div className="mono text-xs text-muted-foreground">EAN {pos.ean}</div>
              {pos.variant && <StatusBadge tone="info">{pos.variant}</StatusBadge>}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="mono">{pos.location}</span>
            {pos.alternativeLocation && (
              <span className="text-muted-foreground">
                alt.: <span className="mono">{pos.alternativeLocation}</span>
              </span>
            )}
          </div>
        </div>
        {error && (
          <ErrorBox
            title={error.title}
            description={error.description}
            onDismiss={() => setError(null)}
          />
        )}
        <ScanPanel
          hint="Zeskanuj produkt"
          onScan={handleProductScan}
          customActions={[
            { label: "Poprawny produkt", code: pos.ean, kind: "ok", variant: "primary" },
            { label: "Zły produkt", code: "5999999999999", kind: "wrong" },
            { label: "Duplikat", code: pos.ean, kind: "duplicate" },
            { label: "Nieznany kod", code: "0000000000000", kind: "unknown" },
          ]}
        />
        <button
          onClick={goBack}
          className="touch-target w-full rounded-md border bg-background text-sm font-medium"
        >
          Wstecz
        </button>
      </div>
    );
  }

  if (view === "quantity" && pos) {
    return (
      <QuantityStage
        pos={pos}
        doneCount={doneCount}
        total={positions.length}
        onPick={(qty, status) => finishPosition(qty, status)}
        onBack={() => setView("product")}
      />
    );
  }

  if (view === "position-done" && pos) {
    const status = pos.status;
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div
          className={cn(
            "grid h-24 w-24 place-items-center rounded-full",
            status === "picked"
              ? "bg-success/20 text-success"
              : status === "short"
                ? "bg-warning/20 text-warning-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {status === "picked" ? (
            <CheckCircle2 className="h-12 w-12" />
          ) : status === "short" ? (
            <AlertTriangle className="h-12 w-12" />
          ) : (
            <SkipForward className="h-12 w-12" />
          )}
        </div>
        <h2 className="text-xl font-bold">
          {status === "picked"
            ? "Pozycja pobrana"
            : status === "short"
              ? "Zgłoszono brak"
              : "Pozycja pominięta"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {pos.productName} — {pos.picked} {pos.unit} z {pos.required} {pos.unit}
        </p>
        <div className="w-full max-w-xs space-y-2 pt-2">
          <button
            onClick={nextPosition}
            className="touch-target w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground"
          >
            {index + 1 >= positions.length ? "Podsumowanie zadania" : "Następna pozycja"}
          </button>
          <button
            onClick={() => setView("task-summary")}
            className="touch-target w-full rounded-md border bg-background text-sm"
          >
            <Flag className="mr-1 inline h-4 w-4" /> Zakończ teraz
          </button>
        </div>
      </div>
    );
  }

  if (view === "task-summary" && task) {
    return (
      <div className="p-3 space-y-3">
        <h1 className="text-lg font-semibold">Podsumowanie: {task.id}</h1>
        <div className="grid grid-cols-2 gap-2">
          <SummaryTile label="Pobrane" value={pickedCount} tone="success" />
          <SummaryTile label="Braki" value={shortCount} tone="warning" />
          <SummaryTile label="Pominięte" value={skippedCount} tone="muted" />
          <SummaryTile label="Pozostało" value={positions.length - doneCount} tone="primary" />
        </div>
        <div className="rounded-lg border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">Pozycje</h3>
          <ul className="space-y-2">
            {positions.map((p) => (
              <li
                key={p.n}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {p.n}. {p.productName}
                  </div>
                  <div className="mono text-xs text-muted-foreground">
                    {p.location} · {p.picked}/{p.required} {p.unit}
                  </div>
                </div>
                <PositionStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="touch-target flex-1 rounded-md border bg-background text-sm font-medium"
          >
            <RotateCcw className="mr-1 inline h-4 w-4" /> Nowe zadanie
          </button>
          <button
            onClick={completeTask}
            className="touch-target flex-[2] rounded-md bg-primary text-sm font-semibold text-primary-foreground"
          >
            Zakończ zadanie i wyślij
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b py-1 last:border-b-0">
      <span className="text-muted-foreground">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function ProgressHeader({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, (current / total) * 100);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold">
          Pozycja {current} z {total}
        </span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ErrorBox({
  title,
  description,
  onDismiss,
}: {
  title: string;
  description: string;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex-1">
          <div className="font-semibold text-destructive">{title}</div>
          <div className="text-xs text-destructive/80">{description}</div>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs font-medium text-destructive hover:underline"
        >
          OK
        </button>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "muted" | "primary";
}) {
  const toneMap = {
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning-foreground border-warning/40",
    muted: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/10 text-primary border-primary/30",
  };
  return (
    <div className={cn("rounded-lg border p-3 text-center", toneMap[tone])}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

function PositionStatusBadge({ status }: { status?: PickingPosition["status"] }) {
  if (status === "picked") return <StatusBadge tone="success">OK</StatusBadge>;
  if (status === "short") return <StatusBadge tone="warning">Brak</StatusBadge>;
  if (status === "skipped") return <StatusBadge tone="muted">Pominięta</StatusBadge>;
  return <StatusBadge tone="info">Oczekuje</StatusBadge>;
}

function QuantityStage({
  pos,
  doneCount,
  total,
  onPick,
  onBack,
}: {
  pos: PickingPosition;
  doneCount: number;
  total: number;
  onPick: (qty: number, status: "picked" | "short" | "skipped") => void;
  onBack: () => void;
}) {
  const [qty, setQty] = useState(pos.required);
  return (
    <div className="p-3 space-y-3">
      <ProgressHeader current={doneCount + 1} total={total} />
      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs text-muted-foreground">Pobierz</div>
        <div className="text-base font-semibold">{pos.productName}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span>Wymagane:</span>
          <span className="mono text-base font-bold">
            {pos.required} {pos.unit}
          </span>
        </div>
      </div>
      <QuantityStepper value={qty} max={pos.required * 2} unit={pos.unit} onChange={setQty} />
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPick(qty, "short")}
          className="touch-target rounded-md border border-destructive/40 bg-destructive/10 text-sm font-medium text-destructive"
        >
          <AlertTriangle className="mr-1 inline h-4 w-4" /> Brak
        </button>
        <button
          onClick={() => onPick(0, "skipped")}
          className="touch-target rounded-md border bg-background text-sm"
        >
          <SkipForward className="mr-1 inline h-4 w-4" /> Pomiń
        </button>
      </div>
      <button
        onClick={() => onPick(qty, "picked")}
        className="touch-target w-full rounded-md bg-primary text-base font-semibold text-primary-foreground"
      >
        Zatwierdź {qty} {pos.unit}
      </button>
      <button
        onClick={onBack}
        className="touch-target w-full rounded-md border bg-background text-sm font-medium"
      >
        Wstecz
      </button>
    </div>
  );
}
