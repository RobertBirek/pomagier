import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/")({
  beforeLoad: () => {
    throw redirect({ to: "/mobile/login" });
  },
});
