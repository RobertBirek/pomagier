import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    try {
      const r = await fetch("/api/wizard/status");
      const { configured, hasEnv } = await r.json();
      if (!configured && !hasEnv) {
        throw redirect({ to: "/wizard" });
      }
    } catch {}
    throw redirect({ to: "/mobile/login" });
  },
});
