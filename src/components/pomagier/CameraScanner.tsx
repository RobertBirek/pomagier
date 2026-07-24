import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef("");

  useEffect(() => {
    const scanner = new Html5Qrcode("camera-scanner-viewport");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.5,
        },
        (decoded) => {
          // Debounce duplicate scans
          if (decoded === lastScanRef.current) return;
          lastScanRef.current = decoded;
          setScanning(false);
          onScan(decoded);
        },
        undefined,
      )
      .catch((err) => {
        console.error("Camera error:", err);
        setError("Nie można uruchomić kamery. Sprawdź uprawnienia.");
        setScanning(false);
      });

    return () => {
      scanner
        .stop()
        .catch(() => {})
        .finally(() => scanner.clear());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">Skanuj kamerą</span>
        <button onClick={onClose} className="touch-target rounded p-2 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Camera viewport */}
      <div id="camera-scanner-viewport" className="flex-1 [&>video]:!h-full [&>video]:!w-full [&>video]:!object-cover" />

      {/* Status */}
      <div className="px-4 py-4 text-center">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {scanning && !error && (
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Szukam kodu...
          </div>
        )}
        {!scanning && !error && (
          <p className="text-green-400 text-sm">Kod zeskanowany</p>
        )}
      </div>
    </div>
  );
}
