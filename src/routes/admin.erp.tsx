import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KpiCard, SectionTitle, LoadingRow, StatusBadge } from "@/components/pomagier/primitives";
import { useErpConfig, AVAILABLE_FIELDS } from "@/hooks/use-erp-config";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErpConnectionForm } from "@/components/admin/ErpConnectionForm";
import { ErpTestButton } from "@/components/admin/ErpTestButton";
import { ErpStatusBadge } from "@/components/admin/ErpStatusBadge";
import { Clock, Package, Users, MapPin, ArrowRightLeft, Save } from "lucide-react";

interface AllWarehouse {
  id: number;
  symbol: string;
  name: string;
  isMain: boolean;
}

async function fetchSupportedWarehouses() {
  const res = await fetch("/api/erp/supported-warehouses");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{
    all: AllWarehouse[];
    supportedIds: number[];
    configured: boolean;
  }>;
}

async function saveSupportedWarehouses(warehouseIds: number[]) {
  const res = await fetch("/api/erp/supported-warehouses", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ warehouseIds }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Błąd");
  return res.json();
}

export const Route = createFileRoute("/admin/erp")({ component: AdminErp });

function AdminErp() {
  const erp = useErpConfig();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [indexStatus, setIndexStatus] = useState<{ name: string; present: boolean }[]>([]);
  const [indexBusy, setIndexBusy] = useState(false);
  const [indexMessage, setIndexMessage] = useState("");

  // Supported warehouses (global toggle)
  const { data: supportedData, isLoading: supportedLoading } = useQuery({
    queryKey: ["erp-supported-warehouses"],
    queryFn: fetchSupportedWarehouses,
  });
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<number[]>([]);

  useEffect(() => {
    if (supportedData && Array.isArray(supportedData.supportedIds)) {
      setSelectedWarehouseIds(supportedData.supportedIds);
    }
  }, [supportedData]);

  const saveSupportedMut = useMutation({
    mutationFn: saveSupportedWarehouses,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erp-supported-warehouses"] });
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });

  // Redirect to login on 401 (session expired) — happens across all queries in this page
  useEffect(() => {
    const authError = qc
      .getQueryCache()
      .findAll()
      .some((q) => {
        const err = q.state.error as Error | null;
        return err?.message.startsWith("HTTP 401");
      });
    if (authError) {
      qc.clear();
      nav({ to: "/admin/login" });
    }
  }, [qc, nav, erp.health, erp.config, erp.fieldMappings]);

  const refreshIndexes = useCallback(async () => {
    const response = await fetch("/api/erp-indexes");
    if (!response.ok) throw new Error("Nie udało się sprawdzić indeksów");
    const data = (await response.json()) as { indexes: { name: string; present: boolean }[] };
    setIndexStatus(data.indexes);
  }, []);

  useEffect(() => {
    if (erp.health?.erp?.ok)
      refreshIndexes().catch(() => setIndexMessage("Brak dostępu do statusu indeksów"));
  }, [erp.health?.erp?.ok, refreshIndexes]);

  const applyIndexes = async () => {
    const confirmation = window.prompt("Wpisz dokładnie: UTWÓRZ INDEKSY");
    if (confirmation !== "UTWÓRZ INDEKSY") return;
    setIndexBusy(true);
    setIndexMessage("");
    try {
      const response = await fetch("/api/erp-indexes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = (await response.json()) as { error?: string; created?: string[] };
      if (!response.ok) throw new Error(data.error || "Nie udało się utworzyć indeksów");
      setIndexMessage(`Utworzono: ${data.created?.length ?? 0}`);
      await refreshIndexes();
    } catch (error) {
      setIndexMessage(error instanceof Error ? error.message : "Błąd indeksów");
    } finally {
      setIndexBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subiekt GT</h1>
        <p className="text-sm text-muted-foreground">Status i konfiguracja połączenia z ERP</p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <SectionTitle title="Status połączenia" />
        <div className="mt-3 flex flex-wrap gap-3">
          <ErpStatusBadge
            ok={erp.health?.erp?.ok ?? false}
            latencyMs={erp.health?.erp?.latencyMs}
          />
          <StatusBadge tone="info">
            <Clock className="mr-1 h-3 w-3" />
            {new Date().toLocaleTimeString("pl-PL")}
          </StatusBadge>
          <button
            onClick={() => erp.refetchHealth()}
            className="text-xs underline text-muted-foreground hover:text-foreground"
          >
            Odśwież
          </button>
        </div>
      </div>

      {erp.company && (
        <div className="rounded-lg border bg-card p-4">
          <SectionTitle title="Firma" />
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Nazwa:</span>{" "}
              <span className="font-semibold">{erp.company.name || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">NIP:</span>{" "}
              <span className="font-mono">{erp.company.nip || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">REGON:</span>{" "}
              <span className="font-mono">{erp.company.regon || "—"}</span>
            </div>
            {erp.company.street && (
              <div>
                <span className="text-muted-foreground">Adres:</span>{" "}
                <span>
                  {erp.company.street}, {erp.company.postalCode} {erp.company.city}
                </span>
              </div>
            )}
            {erp.company.www && (
              <div>
                <span className="text-muted-foreground">WWW:</span>{" "}
                <span className="font-mono">{erp.company.www}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <SectionTitle title="Rekordy w Subiekt GT" />
        {erp.statsLoading && <LoadingRow />}
        {erp.stats && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="tw__Towar"
              value={String(erp.stats.products)}
              hint="Kartoteki towarowe"
              icon={<Package className="h-4 w-4" />}
              tone="primary"
            />
            <KpiCard
              label="sl_Magazyn"
              value={String(erp.stats.warehouses)}
              hint="Magazyny"
              icon={<MapPin className="h-4 w-4" />}
              tone="success"
            />
            <KpiCard
              label="pd_Uzytkownik"
              value={String(erp.stats.users)}
              hint="Operatorzy"
              icon={<Users className="h-4 w-4" />}
              tone="info"
            />
          </div>
        )}

        <div className="rounded-lg border bg-card p-4 max-w-2xl">
          <SectionTitle
            title="Indeksy wydajności Subiekt GT"
            description="Sprawdź i utwórz brakujące indeksy skanowania. Operacja zmienia schemat MSSQL, ale nie dane ERP."
          />
          <div className="mt-3 space-y-2 text-sm">
            {indexStatus.map((index) => (
              <div
                key={index.name}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <code>{index.name}</code>
                <span className={index.present ? "text-green-600" : "text-amber-600"}>
                  {index.present ? "obecny" : "brak"}
                </span>
              </div>
            ))}
            {indexStatus.length === 0 && (
              <p className="text-muted-foreground">
                Brak danych — odśwież status po połączeniu z ERP.
              </p>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              className="rounded-md border px-3 py-2 text-sm"
              onClick={() => refreshIndexes().catch(() => setIndexMessage("Błąd odczytu indeksów"))}
            >
              Sprawdź ponownie
            </button>
            <button
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              disabled={indexBusy || indexStatus.every((index) => index.present)}
              onClick={applyIndexes}
            >
              {indexBusy ? "Tworzę…" : "Utwórz brakujące"}
            </button>
            {indexMessage && <span className="text-sm text-muted-foreground">{indexMessage}</span>}
          </div>
        </div>
      </div>

      {/* Obsługiwane magazyny (globalna lista, Sprint 4) */}
      <div className="rounded-lg border bg-card p-4 max-w-2xl">
        <SectionTitle
          title="Obsługiwane magazyny"
          description="Magazyny dostępne dla wszystkich operatorów. Operatorzy wybierają magazyn przy logowaniu (mobile) lub przed skanem (admin)."
        />
        {supportedLoading && <LoadingRow />}
        {supportedData && (
          <div className="mt-3 space-y-2 text-sm">
            {!supportedData.configured && (
              <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900 text-xs">
                ⚠️ Lista nie skonfigurowana — domyślnie włączony jest tylko magazyn główny (isMain).
                Zaznacz dodatkowe magazyny i zapisz.
              </div>
            )}
            {supportedData.all.map((w) => {
              const checked = selectedWarehouseIds.includes(w.id);
              return (
                <label
                  key={w.id}
                  className="flex items-center justify-between rounded border px-3 py-2 cursor-pointer hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedWarehouseIds((prev) =>
                            prev.includes(w.id) ? prev : [...prev, w.id],
                          );
                        } else {
                          setSelectedWarehouseIds((prev) => prev.filter((id) => id !== w.id));
                        }
                      }}
                      className="h-4 w-4"
                    />
                    <span className="font-mono text-xs">{w.symbol}</span>
                    <span className="text-muted-foreground">— {w.name}</span>
                  </div>
                  {w.isMain && <StatusBadge tone="info">Główny</StatusBadge>}
                </label>
              );
            })}
            {supportedData.all.length === 0 && (
              <p className="text-muted-foreground">
                Brak danych — połącz się z ERP (Status połączenia powyżej).
              </p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => saveSupportedMut.mutate(selectedWarehouseIds)}
                disabled={saveSupportedMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saveSupportedMut.isPending ? "Zapisuję…" : "Zapisz listę"}
              </button>
              <span className="text-xs text-muted-foreground">
                Wybrano: <b>{selectedWarehouseIds.length}</b> z {supportedData.all.length}
              </span>
              {saveSupportedMut.isSuccess && (
                <span className="text-xs text-green-600">✓ Zapisano</span>
              )}
              {saveSupportedMut.error && (
                <span className="text-xs text-red-600">
                  Błąd: {(saveSupportedMut.error as Error).message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <ErpConnectionForm
        form={erp.form}
        saving={erp.saveMut.isPending}
        onChange={erp.setForm}
        onSubmit={() => erp.saveMut.mutate(erp.form)}
      />

      <div className="flex gap-2 max-w-2xl">
        <ErpTestButton onTest={erp.handleTest} testing={erp.testing} testResult={erp.testResult} />
      </div>

      <div className="rounded-lg border bg-card p-4 max-w-2xl">
        <SectionTitle
          title="Mapowanie pól"
          description="Powiąż funkcje PomagierGT z polami własnymi Subiekt GT"
        />
        {erp.fieldMappings && erp.fieldMappings.length > 0 ? (
          <div className="mt-4 space-y-3">
            {erp.fieldMappings.map((fm) => (
              <div
                key={fm.key}
                className="flex items-center gap-3 rounded-md border bg-muted/20 p-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold">{fm.label}</div>
                  <div className="text-xs text-muted-foreground">
                    PomagierGT → Subiekt GT ({fm.subiektTable})
                  </div>
                </div>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={erp.fieldMapByKey.get(fm.key)?.subiektField || fm.subiektField}
                  onChange={(e) =>
                    erp.setFieldMap((prev) =>
                      erp.fieldMapByKey.has(fm.key)
                        ? prev.map((m) =>
                            m.key === fm.key ? { ...m, subiektField: e.target.value } : m,
                          )
                        : [...prev, { key: fm.key, subiektField: e.target.value }],
                    )
                  }
                  className="rounded-md border bg-background px-2 py-1.5 text-sm font-mono"
                >
                  {AVAILABLE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              onClick={() => erp.saveMappingsMut.mutate(erp.fieldMap)}
              disabled={erp.saveMappingsMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {erp.saveMappingsMut.isPending ? "Zapisuję…" : "Zapisz mapowanie"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-3">Brak skonfigurowanych mapowań pól.</p>
        )}
      </div>
    </div>
  );
}
