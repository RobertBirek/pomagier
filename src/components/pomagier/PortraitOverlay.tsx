import { Smartphone } from "lucide-react";

interface PortraitOverlayProps {
  /** Optional message override */
  message?: string;
}

/**
 * Full-screen overlay shown when the device is in landscape orientation.
 * Blocks all interaction until the device is rotated back to portrait.
 */
export function PortraitOverlay({ message }: PortraitOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-black text-white">
      <div className="animate-pulse">
        <Smartphone className="h-20 w-20 rotate-0" />
      </div>
      <p className="text-center text-lg font-semibold px-8">{message ?? "Obróć urządzenie"}</p>
      <p className="text-center text-sm text-gray-400 px-8">
        Aplikacja działa tylko w orientacji pionowej
      </p>
    </div>
  );
}
