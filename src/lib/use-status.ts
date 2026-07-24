import { useQuery } from "@tanstack/react-query";
import { healthCheck } from "./api";

export function useMssqlStatus() {
  const { data } = useQuery({
    queryKey: ["health"],
    queryFn: healthCheck,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
  return { online: data?.erp?.ok ?? false, latencyMs: data?.erp?.latencyMs ?? 0 };
}
