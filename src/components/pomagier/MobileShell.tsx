import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  ScanLine,
  MapPin,
  RefreshCw,
  LogOut,
  User,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Package,
  HardDrive,
  X,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMssqlStatus } from "@/lib/use-status";
import { useDarkMode } from "@/lib/use-dark";
import { useAutoLogout } from "@/lib/use-auto-logout";
import { getQueueCount } from "@/lib/offline-queue";
import { StatusBadge } from "./primitives";
import { cn } from "@/lib/utils";
import { useEffect, useState, useMemo } from "react";

const tabs = [
  { to: "/mobile/dashboard", label: "Start", icon: Home },
  { to: "/mobile/scan", label: "Skanuj", icon: ScanLine },
  { to: "/mobile/locations", label: "Lokaliz.", icon: MapPin },
  { to: "/mobile/sync", label: "Sync", icon: RefreshCw },
];

const titleMap: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  "/mobile/dashboard": { icon: Home, label: "Start", color: "bg-blue-500" },
  "/mobile/scan": { icon: ScanLine, label: "Skanuj", color: "bg-blue-500" },
  "/mobile/locations": { icon: MapPin, label: "Lokalizacje", color: "bg-rose-500" },
  "/mobile/sync": { icon: RefreshCw, label: "Synchronizacja", color: "bg-slate-500" },
  "/mobile/picking": { icon: Package, label: "Kompletacja", color: "bg-emerald-500" },
  "/mobile/inventory": { icon: Shield, label: "Inwentaryzacja", color: "bg-amber-500" },
  "/mobile/receiving": { icon: Package, label: "Dostawy", color: "bg-purple-500" },
  "/mobile/pin": { icon: Shield, label: "Zmień PIN", color: "bg-slate-500" },
  "/mobile/product": { icon: Package, label: "Produkt", color: "bg-primary" },
};

export function MobileShell() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const hideChrome = pathname === "/mobile/login";
  const { operatorName, warehouse, logout } = useAuth();
  const { online } = useMssqlStatus();
  const [dark, toggleDark] = useDarkMode();
  useAutoLogout(15);
  const nav = useNavigate();
  const [queueCount, setQueueCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);

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

  const pageInfo = titleMap[pathname] ?? {
    icon: Package,
    label: "PomagierGT",
    color: "bg-primary",
  };
  const PageIcon = pageInfo.icon;

  const initials = useMemo(() => {
    if (!operatorName) return "?";
    const parts = operatorName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }, [operatorName]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      {!hideChrome && (
        <header className="sticky top-0 z-30 border-b bg-card safe-top min-h-[2.5rem]">
          <div className="flex items-center justify-between px-3 py-2 text-xs">
            {/* Left: page icon + title */}
            <div className="flex items-center gap-1.5 min-w-0 mr-2">
              <div
                className={cn(
                  "grid h-5 w-5 place-items-center rounded text-white shrink-0",
                  pageInfo.color,
                )}
              >
                <PageIcon className="h-3 w-3" />
              </div>
              <span className="truncate font-bold">{pageInfo.label}</span>
            </div>

            {/* Right: queue → warehouse → connection icon → avatar */}
            <div className="flex items-center gap-1.5">
              {queueCount > 0 && (
                <StatusBadge tone="warning" icon={<HardDrive className="h-3 w-3" />}>
                  {queueCount}
                </StatusBadge>
              )}
              {warehouse && (
                <StatusBadge tone="primary" icon={<Package className="h-3 w-3" />}>
                  {warehouse}
                </StatusBadge>
              )}
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full",
                  online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                )}
                title={online ? "Online" : "Offline"}
              >
                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              </span>
              <button
                onClick={() => setShowProfile(true)}
                className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold touch-target hover:bg-primary/90 transition-colors"
                title={operatorName}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Profile modal (outside header stacking context) ── */}
      {showProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowProfile(false)}
        >
          <div
            className="w-72 max-h-[80vh] overflow-y-auto rounded-xl bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold">Profil</span>
              <button
                onClick={() => setShowProfile(false)}
                className="touch-target rounded p-1 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Avatar + name */}
            <div className="flex flex-col items-center gap-2 mb-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {initials}
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm">{operatorName || "Operator"}</div>
                <div className="text-xs text-muted-foreground">{warehouse}</div>
              </div>
            </div>

            <hr className="my-2" />

            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target"
            >
              {dark ? (
                <Sun className="h-5 w-5 text-amber-500" />
              ) : (
                <Moon className="h-5 w-5 text-indigo-400" />
              )}
              <span className="flex-1">{dark ? "Tryb jasny" : "Tryb ciemny"}</span>
              <span className="text-xs text-muted-foreground">{dark ? "☀️" : "🌙"}</span>
            </button>

            <hr className="my-2" />

            {/* Info rows */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 px-1 py-1">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Magazyn</span>
                <span className="ml-auto font-medium">{warehouse}</span>
              </div>
              <div className="flex items-center gap-2 px-1 py-1">
                {online ? (
                  <Wifi className="h-3.5 w-3.5 text-success" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className="text-muted-foreground">Połączenie</span>
                <span className="ml-auto font-medium">{online ? "Online" : "Offline"}</span>
              </div>
              {queueCount > 0 && (
                <div className="flex items-center gap-2 px-1 py-1">
                  <HardDrive className="h-3.5 w-3.5 text-warning-foreground" />
                  <span className="text-muted-foreground">Kolejka offline</span>
                  <span className="ml-auto font-medium">{queueCount}</span>
                </div>
              )}
            </div>

            <hr className="my-2" />

            {/* Logout */}
            <button
              onClick={() => {
                setShowProfile(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors touch-target"
            >
              <LogOut className="h-5 w-5" />
              Wyloguj
            </button>

            <hr className="my-2" />

            {/* Version */}
            <p className="text-center text-[11px] text-muted-foreground/60">PomagierGT v1.2.0</p>
          </div>
        </div>
      )}

      <main className={cn("flex-1", !hideChrome && "pb-20")}>
        <Outlet />
      </main>

      {!hideChrome && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card safe-bottom">
          <div className="grid grid-cols-4 py-1.5">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[12px] font-semibold transition-colors",
                  pathname === t.to || pathname.startsWith(t.to + "/")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon
                  className={cn(
                    "h-6 w-6 sm:h-5 sm:w-5",
                    t.to === "/mobile/sync" &&
                      (!online
                        ? "text-destructive"
                        : queueCount > 0
                          ? "text-amber-500"
                          : "text-success"),
                  )}
                />
                <span className="hidden sm:inline">{t.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
