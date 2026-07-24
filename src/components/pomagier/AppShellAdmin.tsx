import { Link, Outlet, useRouterState } from "@tanstack/react-router";
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
  Building2,
  Wifi,
  WifiOff,
  Map,
  FileText,
  Printer,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
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
import { useDemo } from "@/lib/demo-state";
import { StatusBadge } from "./primitives";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Konfiguracja ERP", url: "/admin/erp", icon: Database },
  { title: "Magazyny", url: "/admin/warehouses", icon: Warehouse },
  { title: "Mapa magazynu", url: "/admin/map", icon: Map },
  { title: "Użytkownicy", url: "/admin/users", icon: Users },
  { title: "Terminale", url: "/admin/terminals", icon: Smartphone },
  { title: "Drukarki", url: "/admin/printers", icon: Printer },
  { title: "Zadania", url: "/admin/tasks", icon: ListTodo },
  { title: "Dokumenty", url: "/admin/documents", icon: FileText },
  { title: "Kolejki", url: "/admin/queues", icon: ListChecks },
  { title: "Logi", url: "/admin/logs", icon: ScrollText },
  { title: "Alerty", url: "/admin/alerts", icon: Bell },
  { title: "Statystyki", url: "/admin/stats", icon: BarChart3 },
  { title: "Podgląd mobile", url: "/admin/mobile-preview", icon: Monitor },
  { title: "Ustawienia", url: "/admin/settings", icon: Settings },
];

function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
        <SidebarGroup>
          <SidebarGroupLabel>Nawigacja</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
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
      </SidebarContent>
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
  const { offline, setOffline } = useDemo();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex items-center gap-2 border-l pl-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Firma Demo Sp. z o.o.</span>
              <StatusBadge tone="warning">DEMO</StatusBadge>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <StatusBadge tone="success">Sfera GT: OK</StatusBadge>
              <StatusBadge tone="success">MSSQL: OK</StatusBadge>
              <button
                onClick={() => setOffline(!offline)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
                  offline
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-success/40 bg-success/10 text-success",
                )}
                title="Przełącz tryb offline (demo)"
              >
                {offline ? <WifiOff className="h-3 w-3" /> : <Wifi className="h-3 w-3" />}
                {offline ? "Offline" : "Online"}
              </button>
              <button
                className="relative rounded-md p-2 hover:bg-accent"
                aria-label="Powiadomienia"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              </button>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                JW
              </div>
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
