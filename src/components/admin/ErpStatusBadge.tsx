import { StatusBadge } from "@/components/pomagier/primitives";
import { Wifi, WifiOff } from "lucide-react";

interface ErpStatusBadgeProps {
  ok: boolean;
  latencyMs?: number;
}

export function ErpStatusBadge({ ok, latencyMs }: ErpStatusBadgeProps) {
  if (ok) {
    return (
      <StatusBadge tone="success">
        <Wifi className="mr-1 h-3 w-3" />
        Połączono{latencyMs !== undefined ? ` (${latencyMs} ms)` : ""}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="danger">
      <WifiOff className="mr-1 h-3 w-3" />
      Rozłączono
    </StatusBadge>
  );
}
