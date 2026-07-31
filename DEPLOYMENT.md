# Deployment — PomagierGT

## Stan: v1.6.1 — Produkcyjny

Środowisko: VPS Linux (Debian/Ubuntu) z systemd.

## Architektura wdrożenia

```
Klient (przeglądarka/PWA)
        │
        ▼ HTTPS (port 443)
┌──────────────────┐
│   Caddy reverse   │ ← mDNS: pomagier.local
│   proxy + static  │ ← certyfikat: mkcert local CA
└──────┬───────────┘
       │
       ├── /api/* → localhost:3000 (Express 5 API, systemd: pomagier-api)
       │
       └── /*     → dist/ (statyczne pliki SPA)
```

## Procedura przed wdrożeniem

1. `git status` — repozytorium musi być czyste.
2. Wykonaj i zweryfikuj backup Postgresa; produkcyjny backup powinien mieć rozszerzenie `.tar.gz.gpg`.
3. Uruchom `npm ci`, `npm run build`, `npm run build:api`, `npm run db:migrate` w kontrolowanym oknie.
4. Zrestartuj API i sprawdź `GET /api/health` oraz logowanie administratora.
5. Migracje wykonuj po backupie; rollback schematu wymaga odtworzenia backupu, nie automatycznego downgrade.

Indeksy MSSQL dla skanowania są przygotowane w `scripts/mssql-indexes.sql`. Uruchomienie wymaga osobnej zgody administratora Subiekta, backupu MSSQL i okna serwisowego.

## Usługi systemd

| Usługa         | Opis                               | Port    |
| -------------- | ---------------------------------- | ------- |
| `pomagier-api` | Express 5 API, auto-restart        | 3000    |
| `caddy`        | Reverse proxy HTTPS + static files | 443, 80 |
| `postgresql`   | Postgres 16 (baza aplikacyjna)     | 5432    |

## Pliki konfiguracyjne

- `.env` — zmienne środowiskowe (NIE committowane, zawiera sekrety)
- `.env.example` — szablon z placeholderami `{{PLACEHOLDER}}`
- `Caddyfile` — konfiguracja reverse proxy
- `/etc/systemd/system/pomagier-api.service` — definicja usługi API

## Deployment flow

```bash
# 1. Pobranie zmian
git pull origin main

# 2. Instalacja zależności (jeśli zmienione)
npm ci

# 3. Build frontendu
npm run build

# 4. Restart API (automatycznie pobiera nowy kod przez tsx)
sudo systemctl restart pomagier-api

# 5. Caddy automatycznie serwuje nowe pliki z dist/
```

## Backup

- Codzienny cron: `scripts/backup.sh`
- Backup bazy Postgres (pg_dump)
- Backup bazy MSSQL (opcjonalnie, tylko read-only snapshot)
- Szyfrowanie: AES-256 z kluczem z `BACKUP_ENCRYPTION_KEY`
- Opcjonalny upload do S3 (AWS SDK)

## Health check

- `GET /api/health` — status API + ERP latency
- `systemctl status pomagier-api` — status usługi
- Caddy automatically handles TLS certificate renewal

## Procedura rollback

```bash
git checkout <poprzedni-tag>
npm ci && npm run build
sudo systemctl restart pomagier-api
```

## Zmienne środowiskowe

Wszystkie zmienne w `.env.example`. Kluczowe:

- `MSSQL_HOST`, `MSSQL_PORT`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`
- `DATABASE_URL` (Postgres)
- `JWT_SECRET`
- `SESSION_TIMEOUT_MINUTES` (domyślnie 15)
- `API_PORT` (domyślnie 3000)
- `CORS_ORIGIN`
- `BACKUP_ENCRYPTION_KEY`
