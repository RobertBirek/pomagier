# AGENTS.md — PomagierGT

## Stan projektu: v1.5.0 Production

| Warstwa | Technologia | Stan |
|---|---|---|
| Frontend/PWA | React 19, TypeScript, TanStack Router, Tailwind CSS 4, shadcn/ui | ✓ Produkcyjny |
| Backend API | Express 5 (port 3000), modularne trasy (14 plików), Zod walidacja | ✓ Produkcyjny |
| Baza aplikacyjna | Postgres 16 (Drizzle ORM) | ✓ Produkcyjny |
| ERP | Insert Subiekt GT (MSSQL read+write, whitelist-validated fields) | ✓ Produkcyjny |
| Reverse proxy | Caddy (HTTPS, port 443) | ✓ Produkcyjny |
| mDNS | avahi-daemon (pomagier.local) | ✓ Produkcyjny |
| Testy | Vitest (85/85), Playwright E2E, RTL render tests | ✓ Aktywne |
| Deployment | systemd (pomagier-api), Caddy static files (frontend) | ✓ Produkcyjny |

## Workflow projektu

1. **Faza 0** — audyt środowiska (tylko odczyt) → max 3 pytania do użytkownika → STOP
2. **Plan v0** — po odpowiedziach, przed kodem
3. **Iteracje** — małe pionowe wycinki: implementacja → testy → demonstracja
4. **Git** — branch `feat/*`, małe commity, PR przed mergem, zakaz force push, zakaz merge do `main`
5. **Dokumentacja** — po każdej skończonej iteracji aktualizuj: CHANGELOG.md, TASKS.md, DB_SCHEMA.md (jeśli zmiany w bazie), AGENTS.md (jeśli zmiany w stacku)

## Agenci projektu

| Agent | Tryb | Plik |
|---|---|---|
| `pomagier` | primary (domyślny) | `.opencode/agents/pomagier.md` |
| `pomagier-reviewer` | subagent | `.opencode/agents/pomagier-reviewer.md` |
| `pomagier-security` | subagent | `.opencode/agents/pomagier-security.md` |
| `pomagier-devops` | subagent | `.opencode/agents/pomagier-devops.md` |
| `pomagier-erp` | subagent | `.opencode/agents/pomagier-erp.md` |

## Skille projektu

| Skill | Plik | Stan |
|---|---|---|
| `subiekt-gt` | `.opencode/skills/subiekt-gt/SKILL.md` | Aktywny — MSSQL read-only, tw__Towar, vwFeniksFirmaSync |
| `pwa-warehouse` | `.opencode/skills/pwa-warehouse/SKILL.md` | Aktywny — PWA, kamera, offline queue |

## Pliki wiedzy

| Plik | Zawartość |
|---|---|
| `README.md` | Opis projektu, architektura, moduły, stan |
| `PRD.md` | Cele, MVP, decyzje otwarte |
| `ARCHITECTURE.md` | Diagram warstw, topologia, odpowiedzialności |
| `SECURITY.md` | Sekrety, RBAC, OWASP, ochrona ERP |
| `TESTING.md` | Poziomy testów, scenariusze, kryteria akceptacji |
| `PLAN.md` | Plan projektu — architektura, moduły, ryzyka, decyzje otwarte |
| `DECISIONS.md` | Rejestr decyzji architektonicznych |
| `DB_SCHEMA.md` | Schemat bazy aplikacyjnej (Postgres + Drizzle) |
| `API.md` | Dokumentacja endpointów API |
| `DEPLOYMENT.md` | Deployment (do weryfikacji) |
| `CHANGELOG.md` | Historia zmian |
| `TASKS.md` | Dziennik wykonanych zadań |

## Zasady bezwzględne (TL;DR)

- **Bez sekretów** w repo — tylko `{{PLACEHOLDERS}}`
- **Bez bezpośredniego zapisu** do tabel Subiekta GT bez jawnej decyzji
- **Bez force push**, bez merge do `main` bez zgody
- **Bez fikcyjnych nazw** tabel/endpointów Subiekta — używaj MCP do weryfikacji
- **Bez `any`** w TypeScript jeśli można określić typ
- **Bez generowania wszystkich modułów naraz** — pionowe przyrosty
- **Bez ignorowania błędów** buildu, lintowania, testów
- **Aktualizuj dokumentację** po każdej iteracji (CHANGELOG, TASKS, DB_SCHEMA)
- Pisz **po polsku** do użytkownika, kod i technikalia **po angielsku**
