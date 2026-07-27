import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Database,
  Warehouse,
  Users,
  Smartphone,
  ListTodo,
  ListChecks,
  ScrollText,
  BarChart3,
  Settings,
  Monitor,
  Bell,
  ChevronRight,
  Search,
  Printer,
  Map,
  Building2,
  FileText,
  Package,
  HardDrive,
  Plus,
  Menu,
  Sun,
  Moon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useMssqlStatus } from "@/lib/use-status";
import { useDarkMode } from "@/lib/use-dark";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./primitives";

const navSections = [
  {
    label: "Monitorowanie",
    items: [
      { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Statystyki", url: "/admin/stats", icon: BarChart3 },
      { title: "Logi", url: "/admin/logs", icon: ScrollText },
    ],
  },
  {
    label: "ERP",
    items: [
      { title: "Konfiguracja ERP", url: "/admin/erp", icon: Database },
      { title: "Backup", url: "/admin/backup", icon: HardDrive },
    ],
  },
  {
    label: "Magazyn",
    items: [
      { title: "Towary", url: "/admin/products", icon: Package },
      { title: "Magazyny", url: "/admin/warehouses", icon: Warehouse },
      { title: "Mapa magazynu", url: "/admin/map", icon: Map },
    ],
  },
  {
    label: "Administracja",
    items: [
      { title: "Użytkownicy", url: "/admin/users", icon: Users },
    ],
  },
];

function AppSidebar({
  operatorName, logout, online, dark, toggleDark,
}: {
  operatorName: string; logout: () => void; online: boolean; dark: boolean; toggleDark: () => void;
}) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const nav = useNavigate();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={cn("flex items-center gap-2 px-3 py-4", collapsed && "justify-center")}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground font-bold">
            P
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">PomagierGT</div>
              <div className="truncate text-xs text-muted-foreground">Panel administracyjny</div>
            </div>
          )}
        </div>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Sidebar footer */}
      <SidebarFooter>
        <div className={cn("border-t px-3 py-3", collapsed && "px-2")}>
          <div className={cn("flex items-center gap-2.5", collapsed && "flex-col gap-3")}>
            {/* Avatar + name + status */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className={cn("relative shrink-0", collapsed && "mx-auto")}>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  {operatorName?.slice(0, 2).toUpperCase() || "OP"}
                </div>
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                  online ? "bg-success" : "bg-muted-foreground/30"
                )} />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight">{operatorName || "Operator"}</div>
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full mt-0.5", online ? "bg-success" : "bg-muted-foreground/30")} />
                </div>
              )}
            </div>

            {/* Logout */}
            <div className={cn("flex items-center gap-0.5 shrink-0", collapsed && "flex-col")}>
              <button onClick={() => { logout(); nav({ to: "/admin/login" }); }} className="touch-target grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors" title="Wyloguj">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function Breadcrumb() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const parts = pathname.split("/").filter(Boolean);
  const label = (p: string) => {
    const map: Record<string, string> = {
      admin: "Administracja",
      dashboard: "Dashboard",
      erp: "Konfiguracja ERP",
      backup: "Backup",
      warehouses: "Magazyny",
      map: "Mapa magazynu",
      users: "Użytkownicy",
      terminals: "Terminale",
      printers: "Drukarki",
      tasks: "Zadania",
      documents: "Dokumenty",
      queues: "Kolejki",
      logs: "Logi",
      alerts: "Alerty",
      stats: "Statystyki",
      settings: "Ustawienia",
      "mobile-preview": "Podgląd mobile",
    };
    return map[p] ?? p;
  };
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          <span className={cn(i === parts.length - 1 && "text-foreground font-medium")}>
            {label(p)}
          </span>
        </span>
      ))}
    </nav>
  );
}

export function AppShellAdmin() {
  const { operatorName, logout } = useAuth();
  const { online } = useMssqlStatus();
  const [dark, toggleDark] = useDarkMode();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar operatorName={operatorName} logout={logout} online={online} dark={dark} toggleDark={toggleDark} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur safe-top">
            <SidebarTrigger />
            <div className="flex items-center gap-2 border-l pl-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">PomagierGT</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <StatusBadge tone={online ? "success" : "danger"}>MSSQL</StatusBadge>
              <StatusBadge tone="success">API</StatusBadge>
              <button onClick={toggleDark} className="touch-target grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" title={dark ? "Jasny" : "Ciemny"}>
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>
          <div className="border-b bg-card/50 px-4 py-2">
            <Breadcrumb />
          </div>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
