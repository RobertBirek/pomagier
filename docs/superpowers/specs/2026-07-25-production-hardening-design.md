# Production Hardening — PomagierGT

## 1. Production Build & Deploy

### API: Compiled TypeScript → JS
- Add `tsconfig.build.json` extending `tsconfig.json` with `"outDir": "dist"`
- Script `npm run build:api`: `tsc -p tsconfig.build.json`
- `pomagier-api.service`: `ExecStart=/usr/bin/node dist/api/server.js` instead of `npx tsx src/api/server.ts`
- Add `"module": "ESNext"` compatible output, or use `tsx` only for dev

### Frontend: Static Build via Caddy
- `vite build` already works — output in `dist/`
- Remove `pomagier-vite.service`
- Update Caddyfile to serve `dist/` directory:
```
pomagier.local, localhost {
    tls /etc/caddy/certs/pomagier.local.pem /etc/caddy/certs/pomagier.local-key.pem
    handle /api/* { reverse_proxy localhost:3000 }
    handle { root * /pomagier/dist; file_server }
}
```
- Remove `basicSsl` dependency (if still referenced)

### Systemd Hardening
```
[Service]
User=pomagier
Group=pomagier
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/pomagier/dist /backups /var/log
Restart=on-failure
RestartSec=3
```

## 2. Security Middleware

### Packages to install
- `helmet`
- `express-rate-limit`

### Configuration
```typescript
// Security
app.use(helmet());
app.use(cors({ origin: ["https://pomagier.local", "https://localhost"], credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", 1);

// Rate limiting
const limiter = rateLimit({ windowMs: 60000, max: 100, standardHeaders: true });
app.use("/api/login", rateLimit({ windowMs: 60000, max: 20 }));
app.use("/api/scan", limiter);
app.use("/api/locations", limiter);
app.use("/api", limiter); // global fallback
```

## 3. Database Migrations

### Generate
```bash
npx drizzle-kit generate
```
Creates migration files in `src/db/migrations/`.

### Auto-migrate on startup
Add to `server.ts` before `app.listen()`:
```typescript
import { migrate } from "drizzle-orm/postgres-js/migrator";
const db = getDb();
await migrate(db, { migrationsFolder: "./src/db/migrations" });
```

## 4. Log Rotation

### Package: `pino-roll`
```typescript
import pino from "pino";
const transport = pino.transport({
  targets: [
    { target: "pino/file", options: { destination: "/var/log/pomagier/api.log" } },
    { target: "pino-roll", options: { file: "/var/log/pomagier/api", frequency: "daily", mkdir: true, limit: { count: 7 } } },
  ],
});
```
- stdout + rolling file
- Daily rotation, 7 files kept

## 5. Docker Healthchecks

### Dockerfile prod stage
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/api/health || exit 1
```

### docker-compose.prod.yml
```yaml
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pomagier"]
      interval: 10s
      retries: 5

  app:
    build:
      target: prod
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 30s
      retries: 3
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://pomagier:pomagier_dev@postgres:5432/pomagier
```

## Files

| File | Action |
|---|---|
| `tsconfig.build.json` | New — build-specific TS config |
| `package.json` | Add build:api script + new deps |
| `src/api/server.ts` | Add helmet, rate-limit, CORS, trust proxy, body limit, auto-migrate |
| `src/lib/logger.ts` | Add pino-roll transport |
| `/etc/caddy/Caddyfile` | Update to serve dist/ static files |
| `/etc/systemd/system/pomagier-api.service` | Update to run compiled JS, add hardening |
| `/etc/systemd/system/pomagier-vite.service` | Remove |
| `docker/Dockerfile` | Fix prod stage, add HEALTHCHECK |
| `docker/docker-compose.yml` | Update for prod target |
| `scripts/setup-prod.sh` | Update for new service config |
| `.env.example` | Add rate-limit config vars |

## Dependencies

| Package | Purpose |
|---|---|
| `helmet` | Security headers |
| `express-rate-limit` | API rate limiting |
| `pino-roll` | Log rotation |
| `wget` (system) | Docker healthcheck |

## Success Criteria
- [ ] `npm run build:api` compiles without errors
- [ ] `npm run build` builds frontend
- [ ] Caddy serves static files from `dist/`
- [ ] API runs as compiled JS via systemd
- [ ] Helmet adds security headers (verify with curl -I)
- [ ] Rate limiting blocks after threshold
- [ ] `npx drizzle-kit generate` creates migration files
- [ ] API auto-migrates on startup
- [ ] Logs rotate to `/var/log/pomagier/`
- [ ] Docker healthcheck passes
