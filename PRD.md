# Product Requirements Document — PomagierGT

## Cel projektu

PomagierGT jest aplikacją webową i mobilną PWA stanowiącą warstwę operacyjną pomiędzy użytkownikami magazynu a systemem ERP Insert Subiekt GT.

## Stan: v1.10.6 — Produkcyjny stabilny (2026-08-03)

MVP (v1.0.0) został osiągnięty 2026-07-26. Wersja v1.10.10 obejmuje global warehouses, comprehensive logging, hardening lokalizacji, timestamp sync, dashboard analytics, centralną wersję aplikacji oraz admin-only pełne czyszczenie lokalizacji produktu. 303 testy pass / 6 skip. System gotowy do dalszego rozwoju modułów magazynowych.

## Zrealizowane moduły

- [x] Informacja o towarze (skanowanie kodu → dane produktu, stany magazynowe)
- [x] Lokalizacja towaru w magazynie (przypisywanie, przenoszenie, reset)
- [x] Admin-only pełne czyszczenie lokalizacji produktu bez nadawania nowej lokalizacji
- [x] Zarządzanie użytkownikami (import z Subiekta, PIN, role admin/operator)
- [x] Panel administracyjny (dashboard, produkty, użytkownicy, magazyny, terminale, backup)
- [x] Logi i audyt (`audit_log`, `product_movements`)
- [x] PWA (Service Worker, offline queue, instalowalna na Android)
- [x] Deployment (systemd, Caddy HTTPS, mDNS pomagier.local)

## Moduły w trakcie rozwoju

- [ ] Inwentaryzacja (szkielet istnieje w `/mobile/inventory`)
- [ ] Kompletacja (szkielet istnieje w `/mobile/picking`)
- [ ] Przyjęcie i weryfikacja dostaw (szkielet istnieje w `/mobile/receiving`)

## Docelowe obszary funkcjonalne

- Informacja o towarze
- Lokalizacja towaru w magazynie
- Inwentaryzacja
- Kompletacja
- Przyjęcie i weryfikacja dostaw
- Przesunięcia magazynowe
- Obsługa zadań magazynowych
- Synchronizacja operacji z Subiektem GT
- Logi, kolejki, statusy i diagnostyka
- Zarządzanie użytkownikami, terminalami i uprawnieniami

## Kluczowe wymagania niefunkcjonalne

- [x] PWA instalowalna na Android
- [x] Obsługa skanerów kodów kreskowych (fizycznych i kamery)
- [x] Praca offline z synchronizacją (kolejka IndexedDB)
- [x] Bezpieczeństwo: RBAC, TLS, httpOnly cookie, idempotencja, audyt
- [x] Ochrona danych ERP — whitelist walidacja pól MSSQL, konto read-only gdzie możliwe

## Decyzje zamknięte

- [x] Topologia: VPS Linux, bezpośredni MSSQL do Subiekta GT po LAN, brak Sfery GT
- [x] Backend: Express 5 + Postgres 16 + Drizzle ORM
- [x] Frontend: React 19 + TanStack Router + Tailwind CSS 4
- [x] Auth: JWT httpOnly cookie, bcrypt PIN, PIN lockout (5 prób/5 min)
- [x] Zakres MVP: informacja o towarze + lokalizacje (zrealizowane)

## Otwarte decyzje

- [ ] Priorytetyzacja kolejnych modułów (inwentaryzacja vs kompletacja vs przyjęcie dostaw)
- [ ] [Nieznane: modele terminali, wersje Androida, typ skanerów w produkcji]
- [ ] [Nieznane: skala produkcyjna — liczba operatorów, skanów/min]
