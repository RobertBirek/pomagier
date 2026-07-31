import { Smartphone } from "lucide-react";

/**
 * Full-screen overlay shown only when Screen Orientation API is unsupported
 * AND the device is in landscape. Normal case: API lock prevents rotation entirely.
 */
export function PortraitOverlay({ message = "Obróć urządzenie" }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-black text-white">
      <div className="animate-pulse">
        <Smartphone className="h-20 w-20" />
      </div>
      <p className="text-center text-lg font-semibold px-8">{message}</p>
      <p className="text-center text-sm text-gray-400 px-8">
        Aplikacja działa tylko w orientacji pionowej
      </p>
    </div>
  );
}
