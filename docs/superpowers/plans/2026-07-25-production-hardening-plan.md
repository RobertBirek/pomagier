# Production Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden PomagierGT for production: security middleware, compiled builds, auto-migrations, log rotation, Docker healthchecks, systemd sandboxing.

**Architecture:** Add helmet + rate-limiting middleware to Express API. Compile TypeScript API to JS via tsc. Remove Vite dev service — Caddy serves static dist/. Enable drizzle auto-migration on startup. Add pino-roll for log rotation. Fix Docker prod stage + healthchecks.

**Tech Stack:** helmet, express-rate-limit, pino-roll, drizzle-kit migrate, tsc, Caddy, systemd

## Global Constraints

- All packages under `/api` except login/health must be rate-limited (100/min)
- Login endpoint rate-limited to 20/min
- CORS restricted to `https://pomagier.local` and `https://localhost`
- Body size limit: 1mb via `express.json({ limit: "1mb" })`
- `trust proxy` enabled (behind Caddy)
- API compiled to `dist/` via tsc
- Frontend served as static files by Caddy from `dist/`
- Systemd services: `User=pomagier`, `NoNewPrivileges=true`
- Logs: stdout + daily rotation to `/var/log/pomagier/`, 7 files kept
- Docker HEALTHCHECK on `/api/health`, 30s interval

---

## Task 1: Install security packages + middleware

**Files:**
- Modify: `package.json`
- Modify: `src/api/server.ts` — top of file

- [ ] **Step 1: Install packages**

```bash
cd /pomagier && npm install helmet express-rate-limit pino-roll 2>&1 | tail -3
```
Expected: installs successfully

- [ ] **Step 2: Add middleware to server.ts**

Read `/pomagier/src/api/server.ts`. Find the lines:
```typescript
app.use(cors());
app.use(express.json());
```
Replace both with:
```typescript
// Security middleware
import helmet from "helmet";
import rateLimit from "express-rate-limit";

app.use(helmet());
app.use(cors({ origin: ["https://pomagier.local", "https://localhost", "http://localhost:5173"], credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", 1);

// Rate limiting
const globalLimiter = rateLimit({ windowMs: 60000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use("/api/login", rateLimit({ windowMs: 60000, max: 20 }));
app.use("/api/scan", globalLimiter);
app.use("/api/locations", globalLimiter);
app.use("/api", globalLimiter);
app.get("/api/health", rateLimit({ windowMs: 60000, max: 300 })); // health can have more
```
Note: Move `import helmet` and `import rateLimit` to the top of the file with other imports. The `app.use("/api/health", ...)` overrides the global limiter — place it BEFORE the global `/api` limiter.

- [ ] **Step 3: Verify headers**

```bash
cd /pomagier && npx tsc --noEmit 2>&1 | head -5
systemctl restart pomagier-api && sleep 10
curl -I -s http://localhost:3000/api/health 2>&1 | grep -E "X-Content-Type|X-Frame|X-DNS|Content-Security|RateLimit"
```
Expected: Shows security headers + rate limit headers

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/api/server.ts
git commit -m "feat: security middleware — helmet, rate-limit, CORS, body limit, trust proxy"
```

---

## Task 2: Generate and auto-run migrations

**Files:**
- Run: `npx drizzle-kit generate`
- Modify: `src/api/server.ts` — add auto-migrate before listen

- [ ] **Step 1: Generate migrations**

```bash
cd /pomagier && npx drizzle-kit generate 2>&1 | tail -5
```
Expected: creates files in `src/db/migrations/`

- [ ] **Step 2: Add auto-migrate to server.ts**

In `src/api/server.ts`, find `const port = parseInt(...)` (near end of file). Add BEFORE it:
```typescript
// Auto-migrate on startup
try {
  import("drizzle-orm/postgres-js/migrator").then(async ({ migrate }) => {
    const db = getDb();
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    logger.info("Database migrations completed");
  });
} catch (err) {
  logger.warn({ err }, "Migration skipped");
}
```

- [ ] **Step 3: Test**

```bash
cd /pomagier && npx tsc --noEmit
systemctl restart pomagier-api && sleep 10
curl -s http://localhost:3000/api/health
journalctl -u pomagier-api --no-pager -n 5 | grep -i migrat
```
Expected: health OK, migrations logged

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/ src/api/server.ts
git commit -m "feat: drizzle migrations + auto-migrate on startup"
```

---

## Task 3: Log rotation

**Files:**
- Modify: `src/lib/logger.ts`

- [ ] **Step 1: Update logger.ts**

Replace the pino configuration in `src/lib/logger.ts`:
```typescript
import pino from "pino";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { fileURLToPath } from "node:url";

const correlationStore = new AsyncLocalStorage<{ correlationId: string }>();
export function withCorrelation<T>(fn: () => T): T { ... }
export function getCorrelationId(): string { ... }

const isProd = process.env.NODE_ENV === "production";

export const logger = pino(
  isProd
    ? pino.transport({
        targets: [
          { target: "pino/file", options: { destination: 1 } }, // stdout
          { target: "pino-roll", options: { file: "/var/log/pomagier/api", frequency: "daily", mkdir: true, limit: { count: 7 } } },
        ],
      })
    : { level: "debug", transport: { target: "pino-pretty", options: { colorize: true } } }
);
```

Keep `serializers` and `mixin` from the existing logger. Use build-time detection: `import.meta.env.PROD` won't work in server.ts — check `process.env.NODE_ENV`.

- [ ] **Step 2: Create log directory**

```bash
mkdir -p /var/log/pomagier && chmod 755 /var/log/pomagier
```

- [ ] **Step 3: Test**

```bash
cd /pomagier && npx tsc --noEmit
systemctl restart pomagier-api && sleep 10
curl -s http://localhost:3000/api/health
ls -la /var/log/pomagier/
```
Expected: log files created in `/var/log/pomagier/`

- [ ] **Step 4: Commit**

```bash
git add src/lib/logger.ts package.json
git commit -m "feat: log rotation — pino-roll, daily, 7 days"
```

---

## Task 4: Production build for API

**Files:**
- Create: `tsconfig.build.json`
- Modify: `package.json` — add build:api script
- Modify: `/etc/systemd/system/pomagier-api.service`

- [ ] **Step 1: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "noEmit": false,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/api/**/*.ts", "src/erp/**/*.ts", "src/db/**/*.ts", "src/lib/**/*.ts"],
  "exclude": ["src/components/**", "src/routes/**", "src/hooks/**", "src/main.tsx", "src/router.tsx", "src/routeTree.gen.ts"]
}
```

- [ ] **Step 2: Add build:api script in package.json**

Add to `"scripts"`:
```json
"build:api": "tsc -p tsconfig.build.json"
```

- [ ] **Step 3: Update systemd service**

Replace `ExecStart` in `/etc/systemd/system/pomagier-api.service`:
```
ExecStart=/usr/bin/node /pomagier/dist/api/server.js
```
Remove `Environment=NODE_ENV=production` (keep `API_PORT=3000`).

Run:
```bash
systemctl daemon-reload
```

- [ ] **Step 4: Create pomagier user if needed**

```bash
id pomagier 2>/dev/null || useradd -r -s /bin/false pomagier
chown -R pomagier:pomagier /pomagier/dist
```

Add to systemd service:
```
User=pomagier
Group=pomagier
NoNewPrivileges=true
```

- [ ] **Step 5: Build and test**

```bash
cd /pomagier && npm run build:api 2>&1 | tail -5
ls dist/api/server.js && echo "BUILD OK"
systemctl restart pomagier-api && sleep 10
curl -s http://localhost:3000/api/health
```
Expected: health OK, running compiled JS

- [ ] **Step 6: Commit**

```bash
git add tsconfig.build.json package.json
git commit -m "feat: production API build — tsc output to dist/"
```

---

## Task 5: Static frontend serving via Caddy

**Files:**
- Modify: `/etc/caddy/Caddyfile`
- Remove: `/etc/systemd/system/pomagier-vite.service`

- [ ] **Step 1: Build frontend**

```bash
cd /pomagier && npx vite build 2>&1 | tail -3
```
Expected: dist/ created with HTML, JS, CSS

- [ ] **Step 2: Update Caddyfile**

Modify `/etc/caddy/Caddyfile`:
```
pomagier.local, localhost {
    tls /etc/caddy/certs/pomagier.local.pem /etc/caddy/certs/pomagier.local-key.pem
    handle /api/* { reverse_proxy localhost:3000 }
    handle {
        root * /pomagier/dist
        file_server
        try_files {path} /index.html
    }
}
```

- [ ] **Step 3: Disable Vite service**

```bash
systemctl disable --now pomagier-vite 2>/dev/null
rm /etc/systemd/system/pomagier-vite.service 2>/dev/null
systemctl daemon-reload
systemctl reload caddy
```

- [ ] **Step 4: Test**

```bash
curl -sk -m 3 -o /dev/null -w "%{http_code}" https://localhost/
curl -sk -m 3 https://localhost/api/health | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"
```
Expected: 200 for frontend, "ok" for API

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: static frontend via Caddy, remove vite service"
```

---

## Task 6: Docker production stage + healthchecks

**Files:**
- Modify: `docker/Dockerfile`
- Create: `docker/docker-compose.prod.yml`

- [ ] **Step 1: Fix Dockerfile prod stage**

Replace the prod stage:
```dockerfile
FROM node:22-alpine AS prod
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/api/health || exit 1
EXPOSE 3000
CMD ["node", "dist/api/server.js"]
```

Also update the build stage to include API build:
```dockerfile
FROM deps AS build
COPY . .
RUN npm run build && npm run build:api
```

- [ ] **Step 2: Create docker-compose.prod.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pomagier
      POSTGRES_USER: pomagier
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pomagier"]
      interval: 10s
      retries: 5

  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
      target: prod
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://pomagier:${PG_PASSWORD}@postgres:5432/pomagier
      - MSSQL_HOST=${MSSQL_HOST}
      - MSSQL_DATABASE=${MSSQL_DATABASE}
      - MSSQL_USER=${MSSQL_USER}
      - MSSQL_PASSWORD=${MSSQL_PASSWORD}
      - NODE_ENV=production
      - API_PORT=3000
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

- [ ] **Step 3: Verify Dockerfile syntax**

```bash
cd /pomagier && docker build -f docker/Dockerfile --target prod -t pomagier:prod . 2>&1 | tail -10
```
(Might fail due to missing build context — just verify syntax)

- [ ] **Step 4: Commit**

```bash
git add docker/Dockerfile docker/docker-compose.prod.yml
git commit -m "feat: Docker production stage + healthchecks + compose.prod"
```

---

## Final Verification

- [ ] **Build check**: `npm run build && npm run build:api`
- [ ] **Type check**: `npx tsc --noEmit`
- [ ] **Test**: `npx vitest run`
- [ ] **Services**: `systemctl status pomagier-api caddy`
- [ ] **Frontend**: `curl -sk https://localhost/` returns 200
- [ ] **API**: `curl -sk https://localhost/api/health` returns OK
- [ ] **Security headers**: `curl -I -sk https://localhost/ | grep -i "x-content-type"`
- [ ] **Logs**: `ls /var/log/pomagier/` shows log files
