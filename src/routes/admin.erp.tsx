import { createFileRoute } from "@tanstack/react-router";
import { KpiCard, SectionTitle, LoadingRow, StatusBadge } from "@/components/pomagier/primitives";
import { useErpConfig, AVAILABLE_FIELDS } from "@/hooks/use-erp-config";
import { ErpConnectionForm } from "@/components/admin/ErpConnectionForm";
import { ErpTestButton } from "@/components/admin/ErpTestButton";
import { ErpStatusBadge } from "@/components/admin/ErpStatusBadge";
import { Clock, Package, Users, MapPin, ArrowRightLeft, Save } from "lucide-react";

export const Route = createFileRoute("/admin/erp")({ component: AdminErp });

function AdminErp() {
  const erp = useErpConfig();

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
