import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, ScanLine, ListTodo, RefreshCw, LogOut, Battery, User } from "lucide-react";
import { useDemo } from "@/lib/demo-state";
import { ConnectionStatus, StatusBadge } from "./primitives";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/mobile/dashboard", label: "Start", icon: Home },
  { to: "/mobile/scan", label: "Skanuj", icon: ScanLine },
  { to: "/mobile/my-tasks", label: "Zadania", icon: ListTodo },
  { to: "/mobile/sync", label: "Sync", icon: RefreshCw },
];

export function MobileShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const hideChrome = pathname === "/mobile/login";
  const { offline, currentOperator, currentWarehouse, pendingSync, battery } = useDemo();

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      {!hideChrome && (
        <header className="sticky top-0 z-30 border-b bg-card">
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate font-medium">{currentOperator}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{currentWarehouse}</span>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatus online={!offline} />
              {pendingSync > 0 && <StatusBadge tone="warning">↑ {pendingSync}</StatusBadge>}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Battery className="h-3.5 w-3.5" />
                {battery}%
              </span>
              <Link
                to="/mobile/login"
                className="ml-1 rounded-md p-1 hover:bg-accent"
                aria-label="Wyloguj"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          {offline && (
            <div className="bg-warning px-3 py-1 text-center text-xs font-semibold text-warning-foreground">
              Tryb offline — operacje trafią do kolejki
            </div>
          )}
        </header>
      )}

      <main className={cn("flex-1", !hideChrome && "pb-20")}>
        <Outlet />
      </main>

      {!hideChrome && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card">
          <div className="mx-auto grid max-w-md grid-cols-4">
            {tabs.map((t) => {
              const active = pathname === t.to || pathname.startsWith(t.to + "/");
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "touch-target flex flex-col items-center justify-center gap-0.5 py-2 text-xs",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <t.icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
