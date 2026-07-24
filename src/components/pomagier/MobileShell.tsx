import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, ScanLine, MapPin, RefreshCw, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMssqlStatus } from "@/lib/use-status";
import { getQueueCount } from "@/lib/offline-queue";
import { ConnectionStatus, StatusBadge } from "./primitives";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const tabs = [
  { to: "/mobile/dashboard", label: "Start", icon: Home },
  { to: "/mobile/scan", label: "Skanuj", icon: ScanLine },
  { to: "/mobile/locations", label: "Lokaliz.", icon: MapPin },
  { to: "/mobile/sync", label: "Sync", icon: RefreshCw },
];

export function MobileShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const hideChrome = pathname === "/mobile/login";
  const { operatorName, warehouse, logout } = useAuth();
  const { online } = useMssqlStatus();
  const nav = useNavigate();
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const check = () => getQueueCount().then(setQueueCount);
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    nav({ to: "/mobile/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      {!hideChrome && (
        <header className="sticky top-0 z-30 border-b bg-card safe-top">
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate font-semibold">{operatorName || "Operator"}</span>
              <span className="text-muted-foreground">· {warehouse}</span>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatus online={online} />
              {queueCount > 0 && (
                <StatusBadge tone="warning">{queueCount}</StatusBadge>
              )}
              <button onClick={handleLogout} className="touch-target rounded p-1 hover:bg-accent" title="Wyloguj">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={cn("flex-1", !hideChrome && "pb-20")}>
        <Outlet />
      </main>

      {!hideChrome && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card safe-bottom">
          <div className="grid grid-cols-4">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "touch-target flex flex-col items-center justify-center gap-0.5 py-1.5 text-xs transition",
                  (pathname === t.to || pathname.startsWith(t.to + "/"))
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
                <span>{t.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
