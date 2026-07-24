# AGENTS.md — PomagierGT

## Stack technologiczny

| Warstwa | Technologia | Stan |
|---|---|---|
| Frontend/PWA | React, TypeScript, TanStack Router, Tailwind CSS | [Do weryfikacji — klon Lovable] |
| Backend API | [Wymaga decyzji] | Nie wybrany |
| Baza aplikacyjna | [Wymaga decyzji — Postgres?] | Nie wybrana |
| ERP | Insert Subiekt GT (MSSQL + Sfera GT) | Dostępny (MSSQL MCP) |
| Deployment | VPS Linux + Docker | [Do weryfikacji] |
| Testy | [Wymaga decyzji — Vitest? Playwright?] | Nie skonfigurowane |

## Workflow projektu

1. **Faza 0** — audyt środowiska (tylko odczyt) → max 3 pytania do użytkownika → STOP
2. **Plan v0** — po odpowiedziach, przed kodem
3. **Iteracje** — małe pionowe wycinki: implementacja → testy → demonstracja
4. **Git** — branch `feat/*`, małe commity, PR przed mergem, zakaz force push, zakaz merge do `main`

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
| `subiekt-gt` | `.opencode/skills/subiekt-gt/SKILL.md` | Szkielet |
| `pwa-warehouse` | `.opencode/skills/pwa-warehouse/SKILL.md` | Szkielet |

## Pliki wiedzy

| Plik | Zawartość |
|---|---|
| `README.md` | Opis projektu, architektura, moduły, stan |
| `PRD.md` | Cele, MVP, decyzje otwarte |
| `ARCHITECTURE.md` | Diagram warstw, topologia, odpowiedzialności |
| `SECURITY.md` | Sekrety, RBAC, OWASP, ochrona ERP |
| `TESTING.md` | Poziomy testów, scenariusze, kryteria akceptacji |
| `PLAN.md` | Szablon planu v0 (do wypełnienia) |
| `DECISIONS.md` | Rejestr decyzji architektonicznych |
| `DB_SCHEMA.md` | Schemat bazy aplikacyjnej (do zaprojektowania) |
| `API.md` | Projekt API (do zaprojektowania) |
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
- Pisz **po polsku** do użytkownika, kod i technikalia **po angielsku**
