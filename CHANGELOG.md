# Changelog

Wszystkie istotne zmiany w projekcie PomagierGT.

Format oparty na [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.0.1] — 2026-07-24

### Added
- Konfiguracja opencode: `default_agent: pomagier`, `instructions: ["AGENTS.md"]`
- Agent główny `pomagier` (primary) z pełną rolą, zasadami workflow, standardami i zakazami
- Subagent `pomagier-reviewer` — code review i QA
- Subagent `pomagier-security` — audyty bezpieczeństwa
- Subagent `pomagier-devops` — Docker, VPS, deployment
- Subagent `pomagier-erp` — integracja Subiekt GT / MSSQL / Sfera GT
- Szkielet skilla `subiekt-gt` — bezpieczne wzorce pracy z MSSQL Subiekta
- Szkielet skilla `pwa-warehouse` — wzorce PWA dla terminali magazynowych
- Pliki wiedzy projektu: README, PRD, ARCHITECTURE, SECURITY, TESTING, PLAN, DECISIONS, DB_SCHEMA, API, DEPLOYMENT, CHANGELOG, TASKS
- AGENTS.md zaktualizowany o stack, workflow, konwencje i zakazy
- Custom commands: `/audyt`, `/review`, `/deploy`
- Reference `lovable-ui` do repozytorium prototypu (RobertBirek/pomagier-magazyn-smart)
- `.env.example` z placeholderami sekretów
- Permisje: `edit: ask`, bash per-operation, docker/rm/push ograniczone
- Kompakcja: `auto: true`, `tail_turns: 20`
