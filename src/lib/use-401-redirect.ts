import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./auth";

/**
 * Globalny handler HTTP 401 (sesja wygasła / nieważny token).
 *
 * Subskrybuje QueryCache - gdy jakikolwiek query rzuci błąd zaczynający się
 * od "HTTP 401", automatycznie:
 *   1. czyści QueryCache (usuwa wszystkie cached dane)
 *   2. woła auth.logout() (czyści localStorage + POST /api/logout)
 *   3. przekierowuje na `redirectTo` (np. /admin/login lub /mobile/login)
 *
 * Edge case: jeśli aktualna ścieżka === redirectTo, NIE przekierowuje
 * (zapobiega pętli gdy user wpisuje złe credentials na stronie logowania).
 */
export function use401Redirect(redirectTo: string) {
  const qc = useQueryClient();
  const auth = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    // Już na stronie logowania - nie przekierowuj (pętla)
    if (pathname === redirectTo) return;

    const unsubscribe = qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      const query = event.query;
      if (query.state.status !== "error") return;
      const error = query.state.error as Error | null;
      if (!error?.message?.startsWith("HTTP 401")) return;

      console.warn(`[401] Session expired, redirecting to ${redirectTo}`);
      qc.clear();
      auth.logout();
      nav({ to: redirectTo });
    });

    return unsubscribe;
  }, [qc, auth, nav, redirectTo, pathname]);
}
