---
name: pwa-warehouse
description: Use when designing or building PWA interfaces for warehouse terminals with barcode scanners. Covers scanner input abstraction (keyboard wedge, camera, DataWedge), offline queue, touch targets for gloved hands, one-hand operation, scan feedback states, Android WebView compatibility. Triggers on: PWA, warehouse, terminal, skaner, barcode, Android, touch, offline, magazyn.
---

# PWA Warehouse Terminal Patterns

Ten skill dokumentuje wzorce projektowania interfejsów PWA na terminale magazynowe.

## Stan

[Do weryfikacji po audycie UI z Lovable] — skill zostanie rozwinięty podczas implementacji klienta magazynowego.

## Główne obszary do udokumentowania

### Abstrakcja skanera

- Interfejs `ScanEvent`: wartość kodu, typ kodu, źródło skanu, czas, terminalId, userId, sessionId, operationContext
- Adaptery: keyboard wedge, DataWedge (Zebra), kamera, manual fallback, demo mock
- Logika biznesowa NIGDY nie związana bezpośrednio z biblioteką kamery

### UX terminala

- Niska rozdzielczość, dotyk, praca jedną ręką, rękawice robocze
- Duże touch targety (>48dp)
- Minimum wpisywania z klawiatury
- Szybki feedback po skanie (<500ms)
- Brak poziomego scrollowania
- Czytelne stany: offline, błąd, synchronizacja

### Offline

- Kolejka operacji w IndexedDB
- Idempotency keys
- Statusy operacji: draft, pending, processing, completed, failed_retryable, failed_permanent, cancelled, conflict
- Rozwiązywanie konfliktów

### PWA

- Service Worker z cache-first dla zasobów statycznych
- Instalowalna na Android (manifest.json, ikony)
- Obsługa WebView na starszych terminalach
