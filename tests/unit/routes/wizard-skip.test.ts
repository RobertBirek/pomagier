import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerWizardRoutes } from "../../../src/api/routes/wizard.js";
import { errorHandler } from "../../../src/api/error-handler.js";

/**
 * Mock adaptera z działającym pool, by móc przetestować ścieżkę sukcesu.
 * Subiekt zwraca 2 userów (uz_Id=1 admin + uz_Id=3 operator).
 */
const mockPool = {
  request: vi.fn().mockReturnValue({
    query: vi.fn().mockImplementation((sql: string) => {
      if (/SELECT.*FROM\s+tw__Towar/i.test(sql)) {
        return Promise.resolve({ recordset: [] });
      }
      if (/SELECT.*uz_Id.*FROM\s+pd_Uzytkownik/i.test(sql)) {
        return Promise.resolve({ recordset: [{ id: 1 }, { id: 3 }] });
      }
      return Promise.resolve({ recordset: [] });
    }),
    input: vi.fn().mockReturnThis(),
  }),
};

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({
    getPool: async () => mockPool,
  }),
}));

const insertCalls: { table: string; values: unknown }[] = [];
const updateCalls: { table: string; whereField: string; whereValue: unknown; set: unknown }[] = [];
const selectResults: Record<string, unknown[]> = {
  config: [],
  locations: [],
  users: [], // pusty = brak istniejących userów → nowi insert
  productLocations: [],
  productMovements: [],
};

const chainable: Record<string, unknown> = {};
const handler: ProxyHandler<Record<string, unknown>> = {
  get(_target, prop) {
    if (typeof prop === "string") {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve([]);
      }
      if (!chainable[prop]) {
        chainable[prop] = (..._args: unknown[]) => new Proxy({}, handler);
      }
      return chainable[prop];
    }
    return undefined;
  },
};

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => {
    return {
      select: (..._args: unknown[]) => {
        const proxy = new Proxy(
          {},
          {
            get(_t, prop) {
              if (prop === "from") {
                return (..._a: unknown[]) => {
                  const p = new Proxy(
                    {},
                    {
                      get(_t2, prop2) {
                        if (prop2 === "where") {
                          return (..._a2: unknown[]) => {
                            const p2 = new Proxy(
                              {},
                              {
                                get(_t3, prop3) {
                                  if (prop3 === "then") {
                                    return (resolve: (v: unknown) => void) => resolve([]);
                                  }
                                  return () => p2;
                                },
                              },
                            );
                            return p2;
                          };
                        }
                        if (prop2 === "then") {
                          return (resolve: (v: unknown) => void) => resolve([]);
                        }
                        return () => proxy;
                      },
                    },
                  );
                  return p;
                };
              }
              if (prop === "then") {
                return (resolve: (v: unknown) => void) => resolve([]);
              }
              return () => proxy;
            },
          },
        );
        return proxy;
      },
      insert: (table: { _: { name: string } }) => ({
        values: (values: unknown) => {
          insertCalls.push({ table: table?._?.name || "unknown", values });
          return {
            onConflictDoNothing: () => Promise.resolve(),
            onConflictDoUpdate: () => Promise.resolve(),
          };
        },
      }),
      update: (table: { _: { name: string } }) => ({
        set: (set: unknown) => ({
          where: (..._args: unknown[]) => {
            updateCalls.push({
              table: table?._?.name || "unknown",
              whereField: "subiekt_uz_id",
              whereValue: _args[0],
              set,
            });
            return Promise.resolve();
          },
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
      transaction: (fn: (tx: unknown) => Promise<void>) =>
        fn({
          delete: () => ({ where: () => Promise.resolve() }),
          insert: (table: { _: { name: string } }) => ({
            values: () => ({
              onConflictDoNothing: () => Promise.resolve(),
            }),
          }),
        }),
    };
  },
  schema: new Proxy(
    {
      config: { _: { name: "config" } },
      locations: { _: { name: "locations" } },
      productLocations: { _: { name: "product_locations" } },
      productMovements: { _: { name: "product_movements" } },
      users: { _: { name: "users" } },
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<string, unknown>)[prop as string];
        return new Proxy({ _: { name: String(prop) } }, {});
      },
    },
  ),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, val) => ({ field, val })),
}));

vi.mock("../../../src/api/routes/locations.js", () => ({
  getLocationField: vi.fn().mockResolvedValue("tw_Pole1"),
}));

vi.mock("../../../src/lib/locations.js", () => ({
  parseLocation: vi.fn().mockReturnValue({
    raw: "A 1-1-1",
    area: "A",
    aisle: 1,
    rack: 1,
    shelf: 1,
    spot: 1,
    label: "Test",
  }),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe("Wizard import-all — skip param + default PIN 0000 (Sprint 3)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls.length = 0;
    updateCalls.length = 0;
    app = express();
    app.use(express.json());
    registerWizardRoutes(app);
    app.use(errorHandler);
  });

  it("skip=locations,productLocations — tylko userzy (PIN 0000)", async () => {
    const res = await request(app)
      .post("/api/wizard/import-all?skip=locations,productLocations")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.results.users).toBeDefined();
    expect(res.body.results.users.seeded).toBe(2);
    expect(res.body.results.users.pins).toEqual([
      { subiektUzId: 1, pin: "0000" },
      { subiektUzId: 3, pin: "0000" },
    ]);
    // locations i productLocations NIE powinny być w wyniku
    expect(res.body.results.locations).toBeUndefined();
    expect(res.body.results.productLocations).toBeUndefined();
  });

  it("bez skip — wszystkie 3 sekcje (locations, productLocations, users)", async () => {
    const res = await request(app).post("/api/wizard/import-all").send({});

    expect(res.status).toBe(200);
    expect(res.body.results.locations).toBeDefined();
    expect(res.body.results.productLocations).toBeDefined();
    expect(res.body.results.users).toBeDefined();
    expect(res.body.results.users.pins[0].pin).toBe("0000");
  });

  it("skip=locations — pomija tylko locations, productLocations i users wykonane", async () => {
    const res = await request(app).post("/api/wizard/import-all?skip=locations").send({});

    expect(res.status).toBe(200);
    expect(res.body.results.locations).toBeUndefined();
    expect(res.body.results.productLocations).toBeDefined();
    expect(res.body.results.users).toBeDefined();
  });

  it("POST /api/wizard/clear — publiczny (bez requireAdmin)", async () => {
    const res = await request(app)
      .post("/api/wizard/clear")
      .send({ tables: ["locations"] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.cleared).toEqual(["locations"]);
  });

  it("default PIN to 0000 (bezpieczeństwo: świadoma decyzja dla LAN onboarding)", async () => {
    const res = await request(app)
      .post("/api/wizard/import-all?skip=locations,productLocations")
      .send({});

    expect(res.status).toBe(200);
    const pins = res.body.results.users.pins as { subiektUzId: number; pin: string }[];
    pins.forEach((p) => {
      expect(p.pin).toBe("0000");
    });
  });
});
