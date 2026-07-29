import { useEffect, useRef, useState } from "react";
import { X, Loader2, Camera, ScanLine } from "lucide-react";

interface Html5QrcodeInstance {
  clear(): void;
  stop(): Promise<void>;
}

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose?: () => void;
  inline?: boolean;
}

export function CameraScanner({ onScan, onClose, inline }: CameraScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(!inline);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const lastScanRef = useRef("");
  const viewportId = useRef(`scanner-${Math.random().toString(36).slice(2, 8)}`);

  const startScanner = () => {
    setActive(true);
    setError(null);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setActive(false);
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    let stopped = false;

    async function init() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        setLoading(false);

        const scanner = new Html5Qrcode(viewportId.current);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.5 },
          (decoded: string) => {
            if (decoded === lastScanRef.current) return;
            lastScanRef.current = decoded;
            onScan(decoded);
            if (inline) stopScanner();
          },
          undefined,
        );
      } catch (err: unknown) {
        if (stopped) return;
        setError("Nie można uruchomić kamery. Sprawdź uprawnienia.");
        setActive(false);
        setLoading(false);
      }
    }

    init();

    return () => {
      stopped = true;
      stopScanner();
    };
  }, [active]);

  // Inline mode
  if (inline) {
    return (
      <div className="space-y-3">
        {active ? (
          <div className="rounded-lg border overflow-hidden bg-black">
            <div className="flex items-center justify-between px-3 py-2 bg-black text-white text-xs">
              <span className="flex items-center gap-1.5">
                <ScanLine className="h-3.5 w-3.5" />
                Skanuję…
              </span>
              <button onClick={stopScanner} className="touch-target rounded p-1 hover:bg-white/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div
              id={viewportId.current}
              className="h-64 [&>video]:!h-full [&>video]:!w-full [&>video]:!object-cover"
            />
            <div className="px-3 py-2 bg-black text-center">
              {loading && <Loader2 className="mx-auto h-4 w-4 animate-spin text-white/60" />}
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
          </div>
        ) : (
          <button
            onClick={startScanner}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-8 text-sm font-medium text-primary hover:bg-primary/10 transition-colors touch-target"
          >
            <Camera className="h-6 w-6" />
            Uruchom skaner
          </button>
        )}
      </div>
    );
  }

  // Fullscreen mode
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">Skanuj kamerą</span>
        <button onClick={onClose} className="touch-target rounded p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        id={viewportId.current}
        className="flex-1 [&>video]:!h-full [&>video]:!w-full [&>video]:!object-cover"
      />
      <div className="px-4 py-4 text-center">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Inicjalizacja kamery...
          </div>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!loading && !error && <p className="text-green-400 text-sm">Kod zeskanowany</p>}
      </div>
    </div>
  );
}
