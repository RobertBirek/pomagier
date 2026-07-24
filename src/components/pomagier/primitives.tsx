import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, Info, Wifi, WifiOff, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type StatusTone = "success" | "warning" | "danger" | "info" | "muted" | "primary";

const toneClass: Record<StatusTone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/30",
};

export function StatusBadge({
  tone = "muted",
  children,
  icon,
}: {
  tone?: StatusTone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function ConnectionStatus({ online, label }: { online: boolean; label?: string }) {
  return (
    <StatusBadge
      tone={online ? "success" : "danger"}
      icon={online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
    >
      {label ?? (online ? "Online" : "Offline")}
    </StatusBadge>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "primary",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: StatusTone;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <div className={cn("rounded-md p-1.5", toneClass[tone])}>{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 p-10 text-center">
      {icon && <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Coś poszło nie tak",
  description,
  retry,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <XCircle className="h-8 w-8 text-destructive" />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {retry && (
        <button
          onClick={retry}
          className="mt-4 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}

export function LoadingRow() {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-3">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Ładowanie…</span>
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export const eventIcon = {
  info: <Info className="h-4 w-4 text-info" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning-foreground" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
};

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-info/30 bg-info/10 p-3 text-xs text-info-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
      <span className="text-foreground/80">{children}</span>
    </div>
  );
}
