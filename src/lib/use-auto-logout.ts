import { useEffect, useRef } from "react";
import { useAuth } from "./auth";
import { useNavigate } from "@tanstack/react-router";

export function useAutoLogout(minutes = 15) {
  const auth = useAuth();
  const nav = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetTimer = () => {
    clearTimeout(timerRef.current);
    if (auth.user) {
      timerRef.current = setTimeout(
        () => {
          auth.logout();
          nav({ to: "/mobile/login" });
        },
        minutes * 60 * 1000,
      );
    }
  };

  useEffect(() => {
    resetTimer();
    const events = ["click", "touchstart", "keydown", "scroll"];
    events.forEach((e) => document.addEventListener(e, resetTimer));
    return () => {
      clearTimeout(timerRef.current);
      events.forEach((e) => document.removeEventListener(e, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user]);
}
