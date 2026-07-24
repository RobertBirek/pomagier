---
description: Uruchamia Fazę 0 — audyt środowiska w trybie tylko do odczytu, raport ze stanu repozytorium, maksymalnie 3 pytania blokujące.
agent: pomagier
---

Wykonaj Fazę 0 audytu środowiska:

1. Sprawdź: katalog roboczy, git status, branch, remote, historię commitów, strukturę repo, package.json, lockfile, TypeScript config, routing, komponenty, mocki, build config, test config, lint/format config, .env.example, Dockerfile, dokumentację, wersję Node.

2. Uruchom tylko bezpieczne polecenia diagnostyczne. Nie modyfikuj kodu. Nie instaluj globalnych pakietów.

3. Przygotuj raport w formacie:

## Co znalazłem
- stack technologiczny,
- stan repozytorium,
- dostępne widoki i komponenty,
- stan buildu, lintowania i testów,
- elementy możliwe do ponownego wykorzystania,
- zauważone problemy techniczne.

## Fakty i niepewności
Używaj oznaczeń: `[Założenie robocze: ...]`, `[Wymaga decyzji: ...]`, `[Nieznane: ...]`, `[Ryzyko: ...]`, `[Do weryfikacji: ...]`

## Maksymalnie 3 pytania blokujące

Po zadaniu pytań zatrzymaj się i poczekaj na odpowiedź.
Nie rozpoczynaj kodowania.
