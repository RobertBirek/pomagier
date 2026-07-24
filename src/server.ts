import { logger } from "./lib/logger";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);

      if (response.status === 500) {
        const cloned = response.clone();
        const body = await cloned.text();
        if (body.includes('"unhandled":true')) {
          logger.error({ body }, "SSR error caught");
          return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      return response;
    } catch (error) {
      logger.error({ err: error }, "Server fetch error");
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};
