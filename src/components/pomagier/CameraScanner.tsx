import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(true);
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef("");

  useEffect(() => {
    let stopped = false;

    async function init() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        setLoading(false);

        const scanner = new Html5Qrcode("camera-scanner-viewport");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.5 },
          (decoded: string) => {
            if (decoded === lastScanRef.current) return;
            lastScanRef.current = decoded;
            setScanning(false);
            onScan(decoded);
          },
          undefined,
        );
      } catch (err: any) {
        if (stopped) return;
        console.error("Camera error:", err);
        setError("Nie można uruchomić kamery. Sprawdź uprawnienia.");
        setScanning(false);
        setLoading(false);
      }
    }

    init();

    return () => {
      stopped = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">Skanuj kamerą</span>
        <button onClick={onClose} className="touch-target rounded p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div id="camera-scanner-viewport" className="flex-1 [&>video]:!h-full [&>video]:!w-full [&>video]:!object-cover" />

      <div className="px-4 py-4 text-center">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Inicjalizacja kamery...
          </div>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {scanning && !error && !loading && (
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Szukam kodu...
          </div>
        )}
        {!scanning && !error && !loading && <p className="text-green-400 text-sm">Kod zeskanowany</p>}
      </div>
    </div>
  );
}
