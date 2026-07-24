# Product Requirements Document — PomagierGT

## Cel projektu

PomagierGT jest aplikacją webową i mobilną PWA stanowiącą warstwę operacyjną pomiędzy użytkownikami magazynu a systemem ERP Insert Subiekt GT.

## MVP — pierwszy pionowy wycinek

[Wymaga decyzji: wybór pierwszego modułu MVP]

Kandydaci (kolejność proponowana):

1. **Informacja o towarze po zeskanowaniu kodu** — najniższe ryzyko integracji, najprostszy flow, szybki do przetestowania, natychmiastowa wartość dla magazyniera.
2. Lokalizacja towaru
3. Inwentaryzacja
4. Kompletacja
5. Weryfikacja dostawy

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

- PWA instalowalna na Android
- Obsługa skanerów kodów kreskowych (fizycznych i kamery)
- Praca offline z synchronizacją
- Bezpieczeństwo: RBAC, TLS, idempotencja, audyt
- Ochrona danych ERP — domyślnie tylko odczyt, zapis przez Sferę GT

## Otwarte decyzje

- [Wymaga decyzji: wybór pierwszego modułu MVP]
- [Wymaga decyzji: topologia systemu — VPS Linux + connector Windows?]
- [Wymaga decyzji: zakres operacji ERP w MVP — tylko odczyt czy też zapis?]
- [Wymaga decyzji: technologia backendu]
- [Wymaga decyzji: baza aplikacyjna — Postgres czy inna?]
- [Wymaga decyzji: sposób uwierzytelniania operatorów]
- [Nieznane: modele terminali, wersje Androida, typ skanerów]
- [Nieznane: dostępność Sfery GT i jej API]
- [Nieznane: skala — liczba magazynów, operatorów, towarów]
