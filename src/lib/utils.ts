import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Short audio feedback used for barcode scan confirmations. */
export function beep(freq: number, duration = 120) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = "square";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    /* AudioContext may not be available (e.g. WebView without audio) */
  }
}

/** Short haptic feedback via vibration (Android terminals). No permissions needed. */
export function haptic(duration = 50) {
  try {
    navigator.vibrate?.(duration);
  } catch {
    /* vibration API may not be available */
  }
}

/** Get initials from full name. "Jan Kowalski" → "JK", "Anna" → "AN" */
export function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "??";
}
