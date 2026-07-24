# PomagierGT

Aplikacja webowa i mobilna PWA stanowiąca warstwę operacyjną pomiędzy użytkownikami magazynu a systemem ERP **Insert Subiekt GT**.

## Architektura

System składa się z dwóch części:

1. **Panel administracyjny** — przeznaczony głównie na desktop. Zarządzanie użytkownikami, terminalami, uprawnieniami, konfiguracją, monitoring operacji i synchronizacji.

2. **Klient magazynowy (PWA)** — działający na terminalach Android z fizycznym czytnikiem kodów kreskowych, telefonach Android (kamera) oraz innych urządzeniach z przeglądarką.

## Docelowe moduły

- Informacja o towarze (skanowanie kodu → dane produktu i lokalizacja)
- Lokalizacja towaru w magazynie
- Inwentaryzacja
- Kompletacja
- Przyjęcie i weryfikacja dostaw
- Przesunięcia magazynowe
- Obsługa zadań magazynowych
- Synchronizacja operacji z Subiektem GT
- Logi, kolejki, statusy i diagnostyka
- Zarządzanie użytkownikami, terminalami i uprawnieniami

## Repozytorium

**Produkcyjne**: https://github.com/RobertBirek/pomagier.git

**Prototyp UI (Lovable)**: https://github.com/RobertBirek/pomagier-magazyn-smart.git — tylko referencja UI/UX, nie architektura produkcyjna.

## Stan projektu

- [x] Konfiguracja opencode (agenci, skille, pliki wiedzy)
- [ ] Faza 0: Audyt repozytorium i środowiska
- [ ] Faza 1: Pierwszy pionowy wycinek MVP
