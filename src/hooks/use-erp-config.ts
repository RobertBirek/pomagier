import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { getStats, getCompany, healthCheck } from "@/lib/api";

async function fetchErpConfig() {
  const res = await fetch("/api/erp-config");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }>;
}

async function saveErpConfig(data: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}) {
  const res = await fetch("/api/erp-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Błąd");
  return res.json();
}

async function testConnection(data: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}) {
  const res = await fetch("/api/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
}

async function fetchFieldMappings() {
  const res = await fetch("/api/field-mappings");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<
    { key: string; label: string; subiektField: string; subiektTable: string }[]
  >;
}

async function saveFieldMappings(mappings: { key: string; subiektField: string }[]) {
  const res = await fetch("/api/field-mappings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mappings),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export const AVAILABLE_FIELDS = [
  { value: "tw_Pole1", label: "tw_Pole1 (varchar 50)" },
  { value: "tw_Pole2", label: "tw_Pole2 (varchar 50)" },
  { value: "tw_Pole3", label: "tw_Pole3 (varchar 50)" },
  { value: "tw_Pole4", label: "tw_Pole4 (varchar 50)" },
  { value: "tw_Pole5", label: "tw_Pole5 (varchar 50)" },
  { value: "tw_Pole6", label: "tw_Pole6 (varchar 50)" },
  { value: "tw_Pole7", label: "tw_Pole7 (varchar 50)" },
  { value: "tw_Pole8", label: "tw_Pole8 (varchar 50)" },
];

export function useErpConfig() {
  const qc = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 15_000,
  });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ["health"],
    queryFn: healthCheck,
    refetchInterval: 10_000,
  });
  const { data: config } = useQuery({ queryKey: ["erp-config"], queryFn: fetchErpConfig });
  const { data: fieldMappings, refetch: refetchMappings } = useQuery({
    queryKey: ["field-mappings"],
    queryFn: fetchFieldMappings,
  });

  const [form, setForm] = useState({ host: "", port: 1433, database: "", user: "", password: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [fieldMap, setFieldMap] = useState<{ key: string; subiektField: string }[]>([]);

  useEffect(() => {
    if (config) {
      setForm({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: "",
      });
    }
  }, [config]);

  useEffect(() => {
    if (Array.isArray(fieldMappings)) {
      setFieldMap(fieldMappings.map((m) => ({ key: m.key, subiektField: m.subiektField })));
    }
  }, [fieldMappings]);

  const fieldMapByKey = useMemo(() => new Map(fieldMap.map((m) => [m.key, m])), [fieldMap]);

  const saveMut = useMutation({
    mutationFn: saveErpConfig,
    onSuccess: () => {
      toast.success("Konfiguracja zapisana");
      qc.invalidateQueries({ queryKey: ["health"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["company"] });
      refetchHealth();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMappingsMut = useMutation({
    mutationFn: saveFieldMappings,
    onSuccess: () => {
      toast.success("Mapowanie zapisane");
      refetchMappings();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testConnection(form);
      setTestResult(r);
      if (r.ok) toast.success(`Połączono (${r.latencyMs} ms)`);
      else toast.error(r.error || "Błąd połączenia");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setTestResult({ ok: false, error: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return {
    stats,
    statsLoading,
    company,
    health,
    refetchHealth,
    config,
    form,
    setForm,
    testing,
    testResult,
    fieldMappings,
    fieldMap,
    setFieldMap,
    fieldMapByKey,
    saveMut,
    saveMappingsMut,
    handleTest,
    refetchMappings,
  };
}
