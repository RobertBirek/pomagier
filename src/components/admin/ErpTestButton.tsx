import { FlaskConical } from "lucide-react";

interface ErpTestButtonProps {
  onTest: () => void;
  testing: boolean;
  testResult: { ok: boolean; latencyMs?: number; error?: string } | null;
}

export function ErpTestButton({ onTest, testing, testResult }: ErpTestButtonProps) {
  return (
    <>
      <button
        onClick={onTest}
        disabled={testing}
        className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
      >
        <FlaskConical className="h-4 w-4" />
        {testing ? "Testuję…" : "Testuj połączenie"}
      </button>
      {testResult && (
        <div
          className={`rounded-md p-3 text-sm ${testResult.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
        >
          {testResult.ok
            ? `✓ Połączono pomyślnie (${testResult.latencyMs} ms)`
            : `✗ ${testResult.error || "Błąd połączenia"}`}
        </div>
      )}
    </>
  );
}
