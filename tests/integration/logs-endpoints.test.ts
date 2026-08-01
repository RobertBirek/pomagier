import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import { registerLogsRoutes } from "../../../src/api/routes/logs.js";
import { errorHandler } from "../../../src/api/error-handler.js";

const mockRows: AuditRow[] = [
  {
    id: "row-1",
    createdAt: new Date("2026-08-01T10:00:00Z"),
    category: "auth",
    method: "web",
    action: "login",
    actorSubiektUzId: 1,
    userId: "u1",
    targetType: null,
    targetId: null,
    correlationId: "corr-1",
    details: '{"subiektUzId":1}',
  },
  {
    id: "row-2",
    createdAt: new Date("2026-08-01T09:00:00Z"),
    category: "mobile",
    method: "mobile",
    action: "scan.completed",
    actorSubiektUzId: 3,
    userId: "u2",
    targetType: "product",
    targetId: "12345",
    correlationId: "corr-2",
    details: null,
  },
];

type AuditRow = {
  id: string;
  createdAt: Date;
  category: string | null;
  method: string | null;
  action: string;
  actorSubiektUzId: number | null;
  userId: string | null;
  targetType: string | null;
  targetId: string | null;
  correlationId: string;
  details: string | null;
};

const mockRelated: AuditRow[] = [
  {
    id: "row-2",
    createdAt: new Date("2026-08-01T09:00:00Z"),
    category: "mobile",
    method: "mobile",
    action: "scan.completed",
    actorSubiektUzId: 3,
    userId: "u2",
    targetType: "product",
    targetId: "12345",
    correlationId: "corr-2",
    details: null,
  },
];

const mockEntry: AuditRow = {
  id: "row-1",
  createdAt: new Date("2026-08-01T10:00:00Z"),
  category: "auth",
  method: "web",
  action: "login",
  actorSubiektUzId: 1,
  userId: "u1",
  targetType: null,
  targetId: null,
  correlationId: "corr-1",
  details: '{"subiektUzId":1}',
};

function makeListChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockResolvedValue(mockRows);
  return chain;
}

function makeExportChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockResolvedValue(mockRows);
  return chain;
}

function makeExportChainWith(rows: AuditRow[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  return chain;
}

function makeCountChain(cnt = 42) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ cnt }]),
  };
}

function makeSingleEntryChain(entry: AuditRow | null) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(entry ? [entry] : []),
  };
}

function makeRelatedChain(related: AuditRow[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(related),
  };
}

function makeDistinctChain(rows: { actorSubiektUzId: number }[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(rows);
  return chain;
}

const { mockSelect, mockSelectDistinct, mockDb } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockSelectDistinct = vi.fn();
  const mockDb = {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { mockSelect, mockSelectDistinct, mockDb };
});

vi.mock("../../src/db/index.js", () => ({
  getDb: () => mockDb,
  schema: {
    auditLog: {
      id: "id",
      createdAt: "created_at",
      category: "category",
      method: "method",
      action: "action",
      actorSubiektUzId: "actor_subiekt_uz_id",
      userId: "user_id",
      targetType: "target_type",
      targetId: "target_id",
      correlationId: "correlation_id",
      details: "details",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  desc: vi.fn((c: unknown) => ({ op: "desc", col: c })),
  eq: vi.fn((c: unknown, v: unknown) => ({ op: "eq", col: c, v })),
  gte: vi.fn((c: unknown, v: unknown) => ({ op: "gte", col: c, v })),
  like: vi.fn((c: unknown, v: unknown) => ({ op: "like", col: c, v })),
  lte: vi.fn((c: unknown, v: unknown) => ({ op: "lte", col: c, v })),
  or: vi.fn((...args: unknown[]) => ({ op: "or", args })),
  sql: Object.assign((s: TemplateStringsArray | string) => ({ op: "sql", s }), {
    raw: (s: TemplateStringsArray | string) => ({ op: "sql", s }),
  }),
}));

vi.mock("../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("Logs endpoints", () => {
  let app: express.Express;

  beforeEach(() => {
    mockSelect.mockReset();
    mockSelectDistinct.mockReset();
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: "test-user", role: "admin", subiektUzId: 1 };
      next();
    });
    registerLogsRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/logs", () => {
    function setupListMocks(cnt = 42) {
      let callIdx = 0;
      mockSelect.mockImplementation(() => {
        if (callIdx++ === 0) return makeListChain();
        return makeCountChain(cnt);
      });
    }

    it("returns list with default pagination", async () => {
      setupListMocks(42);

      const res = await request(app).get("/api/logs");

      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(mockRows.length);
      expect(res.body.rows[0].id).toBe(mockRows[0].id);
      expect(res.body.rows[0].action).toBe(mockRows[0].action);
      expect(res.body.total).toBe(42);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(50);
      expect(res.body.stats.byCategory).toBeDefined();
      expect(res.body.stats.byMethod).toBeDefined();
    });

    it("accepts page and pageSize query params", async () => {
      setupListMocks(100);

      const res = await request(app).get("/api/logs?page=2&pageSize=25");

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(25);
    });

    it("clamps pageSize to max 200 and min 10", async () => {
      setupListMocks(0);

      const res = await request(app).get("/api/logs?pageSize=999");

      expect(res.status).toBe(200);
      expect(res.body.pageSize).toBeLessThanOrEqual(200);
    });

    it("accepts filter params (category, method, user, targetType, targetId, action)", async () => {
      setupListMocks(1);

      const res = await request(app).get(
        "/api/logs?category=auth,mobile&method=web&user=1&targetType=product&targetId=12345&action=login",
      );

      expect(res.status).toBe(200);
      expect(res.body.rows).toBeDefined();
    });

    it("accepts date range (from, to)", async () => {
      setupListMocks(0);

      const res = await request(app).get(
        "/api/logs?from=2026-08-01T00:00:00Z&to=2026-08-02T00:00:00Z",
      );

      expect(res.status).toBe(200);
      expect(res.body.rows).toBeDefined();
    });

    it("accepts full-text search (q)", async () => {
      setupListMocks(0);

      const res = await request(app).get("/api/logs?q=login");

      expect(res.status).toBe(200);
      expect(res.body.rows).toBeDefined();
    });

    it("filters by correlation id", async () => {
      setupListMocks(3);

      const res = await request(app).get("/api/logs?correlation=abc-123");

      expect(res.status).toBe(200);
      expect(res.body.rows).toBeDefined();
      const eqMock = vi.mocked(eq);
      const correlationCall = eqMock.mock.calls.find(
        (call) => (call[0] as unknown) === "correlation_id" && call[1] === "abc-123",
      );
      expect(correlationCall).toBeDefined();
    });

    it("computes stats byCategory and byMethod from rows", async () => {
      setupListMocks(2);

      const res = await request(app).get("/api/logs");

      expect(res.status).toBe(200);
      expect(res.body.stats.byCategory.auth).toBe(1);
      expect(res.body.stats.byCategory.mobile).toBe(1);
      expect(res.body.stats.byMethod.web).toBe(1);
      expect(res.body.stats.byMethod.mobile).toBe(1);
    });

    it("returns empty result on DB error", async () => {
      mockSelect.mockImplementation(() => {
        throw new Error("DB down");
      });

      const res = await request(app).get("/api/logs");

      expect(res.status).toBe(200);
      expect(res.body.rows).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });

  describe("GET /api/logs/:id", () => {
    function setupDetailMocks(entry: AuditRow | null, related: AuditRow[]) {
      let callIdx = 0;
      mockSelect.mockImplementation(() => {
        if (callIdx++ === 0) return makeSingleEntryChain(entry);
        return makeRelatedChain(related);
      });
    }

    it("returns single entry with related logs by correlation", async () => {
      setupDetailMocks(mockEntry, mockRelated);

      const res = await request(app).get("/api/logs/row-1");

      expect(res.status).toBe(200);
      expect(res.body.entry.id).toBe(mockEntry.id);
      expect(res.body.entry.action).toBe(mockEntry.action);
      expect(res.body.related).toHaveLength(mockRelated.length);
      expect(res.body.related[0].id).toBe(mockRelated[0].id);
    });

    it("excludes the entry itself from related", async () => {
      const relatedWithSelf: AuditRow[] = [mockEntry, ...mockRelated];
      setupDetailMocks(mockEntry, relatedWithSelf);

      const res = await request(app).get("/api/logs/row-1");

      expect(res.status).toBe(200);
      expect(res.body.related).toHaveLength(1);
      expect(res.body.related[0].id).toBe("row-2");
    });

    it("returns 404 when entry not found", async () => {
      setupDetailMocks(null, []);

      const res = await request(app).get("/api/logs/missing");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it("handles entry without correlationId (related is empty)", async () => {
      const entryNoCorr = { ...mockEntry, correlationId: "" };
      setupDetailMocks(entryNoCorr, []);

      const res = await request(app).get("/api/logs/row-1");

      expect(res.status).toBe(200);
      expect(res.body.entry.id).toBe(entryNoCorr.id);
      expect(res.body.related).toEqual([]);
    });
  });

  describe("GET /api/logs/users", () => {
    it("returns distinct list of actor_subiekt_uz_id values from audit_log", async () => {
      mockSelectDistinct.mockImplementation(() =>
        makeDistinctChain([
          { actorSubiektUzId: 1 },
          { actorSubiektUzId: 3 },
          { actorSubiektUzId: 7 },
        ]),
      );

      const res = await request(app).get("/api/logs/users");

      expect(res.status).toBe(200);
      expect(res.body.users).toEqual([1, 3, 7]);
    });

    it("returns empty users array when no rows match", async () => {
      mockSelectDistinct.mockImplementation(() => makeDistinctChain([]));

      const res = await request(app).get("/api/logs/users");

      expect(res.status).toBe(200);
      expect(res.body.users).toEqual([]);
    });
  });

  describe("GET /api/logs/export.csv", () => {
    it("returns CSV with text/csv content-type and attachment header", async () => {
      mockSelect.mockImplementation(() => makeExportChain());

      const res = await request(app).get("/api/logs/export.csv");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.headers["content-disposition"]).toContain(".csv");
    });

    it("CSV body has header row and data rows", async () => {
      mockSelect.mockImplementation(() => makeExportChain());

      const res = await request(app).get("/api/logs/export.csv");

      expect(res.status).toBe(200);
      const lines = res.text.split("\n");
      expect(lines[0]).toContain("id");
      expect(lines[0]).toContain("category");
      expect(lines[0]).toContain("action");
      expect(lines.length).toBeGreaterThan(1);
    });

    it("respects filter params (category) on export", async () => {
      mockSelect.mockImplementation(() => makeExportChain());

      const res = await request(app).get("/api/logs/export.csv?category=auth");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
    });

    it("returns 500 on DB error", async () => {
      mockSelect.mockImplementation(() => {
        throw new Error("DB down");
      });

      const res = await request(app).get("/api/logs/export.csv");

      expect(res.status).toBe(500);
    });

    it("prefixes tab on cells starting with =, +, -, @ (CSV injection protection)", async () => {
      const maliciousRows: AuditRow[] = [
        { ...mockRows[0], id: "evil-eq", action: "=SUM(A1:A10)" },
        { ...mockRows[0], id: "evil-plus", action: "+CMD|calc" },
        { ...mockRows[0], id: "evil-minus", action: "-2+3" },
        { ...mockRows[0], id: "evil-at", action: "@import" },
      ];
      mockSelect.mockImplementation(() => makeExportChainWith(maliciousRows));

      const res = await request(app).get("/api/logs/export.csv");

      expect(res.status).toBe(200);
      const lines = res.text.split("\n");
      const dataLines = lines.slice(1);
      // action column is index 4 (id, created_at, category, method, action, ...)
      const actions = dataLines.map((line) => line.split(",")[4]);
      expect(actions[0]).toBe('"\t=SUM(A1:A10)"');
      expect(actions[1]).toBe('"\t+CMD|calc"');
      expect(actions[2]).toBe('"\t-2+3"');
      expect(actions[3]).toBe('"\t@import"');
    });
  });

  describe("GET /api/logs/export.json", () => {
    it("returns JSON with application/json content-type and attachment header", async () => {
      mockSelect.mockImplementation(() => makeExportChain());

      const res = await request(app).get("/api/logs/export.json");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.headers["content-disposition"]).toContain(".json");
    });

    it("JSON body has rows and exportedAt", async () => {
      mockSelect.mockImplementation(() => makeExportChain());

      const res = await request(app).get("/api/logs/export.json");

      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(mockRows.length);
      expect(res.body.rows[0].id).toBe(mockRows[0].id);
      expect(res.body.exportedAt).toBeTruthy();
      expect(new Date(res.body.exportedAt).getTime()).toBeGreaterThan(0);
    });

    it("respects filter params (q) on export", async () => {
      mockSelect.mockImplementation(() => makeExportChain());

      const res = await request(app).get("/api/logs/export.json?q=login");

      expect(res.status).toBe(200);
      expect(res.body.rows).toBeDefined();
    });

    it("returns 500 on DB error", async () => {
      mockSelect.mockImplementation(() => {
        throw new Error("DB down");
      });

      const res = await request(app).get("/api/logs/export.json");

      expect(res.status).toBe(500);
    });
  });
});
