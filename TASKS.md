# TASKS — PomagierGT v1.2.0

| Data | Zadanie | Status |
|---|---|---|
| 2026-07-28 | ScanHeader: unified scan input component (sticky, flash, autocomplete, tools, camera) | ✅ |
| 2026-07-28 | ScanHeader: inputmode="none" — no Android keyboard on scanner terminals | ✅ |
| 2026-07-28 | ScanHeader: tools modal — repeat last, manual toggle, camera scanner, recent codes | ✅ |
| 2026-07-28 | ScanHeader: haptic feedback + scanBus integration | ✅ |
| 2026-07-28 | Refactor /mobile/scan → ScanHeader (279→154 lines) | ✅ |
| 2026-07-28 | Refactor /mobile/locations → ScanHeader (229→273 lines) | ✅ |
| 2026-07-28 | Refactor /mobile/inventory → ScanHeader (466→204 lines) | ✅ |
| 2026-07-28 | Remove old ScanInput.tsx | ✅ |
| 2026-07-28 | New: useRecentCodes.ts hook + haptic() utility | ✅ |
| 2026-07-28 | Lint: 270→130 problems (auto-fix 122 prettier), fix any types in wizard | ✅ |
| 2026-07-28 | Unified placeholder: "Zeskanuj kod" across all pages | ✅ |
| 2026-07-27 | Security: SQL Injection fix (whitelist locationField) | ✅ |
| 2026-07-27 | Security: Token removed from localStorage (httpOnly cookie only) | ✅ |
| 2026-07-27 | Security: PIN brute-force lockout (5 attempts/5 min) | ✅ |
| 2026-07-27 | Refactor /mobile/locations: components + hooks extraction | ✅ |
| 2026-07-27 | UX: loading states, idempotency keys, fewer toasts | ✅ |
| 2026-07-27 | Test fixes: integration (real EAN), auth (bcrypt), 15/15 ✅ | ✅ |
| 2026-07-27 | Docs: DECISIONS, PRD, DEPLOYMENT, CHANGELOG updated | ✅ |
| 2026-07-26 | Production hardening — helmet, rate-limit, bcrypt, httpOnly | ✅ |
| 2026-07-26 | Route extraction, integration tests, VPN | ✅ |
| 2026-07-26 | React optimizations (10 fixes), UI polish | ✅ |
| 2026-07-26 | Self-service PIN change, docs update | ✅ |
| 2026-07-25 | Role-based access, admin login, PIN management | ✅ |
| 2026-07-25 | Backup system, deployment wizard | ✅ |
| 2026-07-25 | Warehouse grid, sync verification, dark mode | ✅ |
| 2026-07-25 | Locations UX — names, sound, transfer, reset, undo | ✅ |
| 2026-07-25 | Production stack — pomagier.local, Caddy, mkcert, systemd | ✅ |
| 2026-07-24 | Camera scanner, HTTPS, PWA | ✅ |
| 2026-07-24 | Location system, admin panel, product list | ✅ |
| 2026-07-24 | SSR → SPA migration, Express API | ✅ |
| 2026-07-24 | MVP foundation — stack, Docker, ERP adapter, mobile flow | ✅ |
