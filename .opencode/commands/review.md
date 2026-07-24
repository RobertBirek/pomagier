---
description: Deleguje przegląd kodu do subagenta pomagier-reviewer. Przeprowadza pełny code review ostatnich zmian: build, lint, typecheck, testy, edge case, adversarial.
agent: pomagier-reviewer
---

Przeprowadź pełny code review ostatnich zmian w repozytorium.

1. Sprawdź git diff i zmienione pliki.
2. Zweryfikuj zgodność ze standardami kodu (typowanie, modularność, brak `any`, obsługa błędów, correlation ID, idempotencja).
3. Sprawdź czy build, lint, typecheck i testy przechodzą.
4. Przetestuj edge case (nieznane dane, timeout, wielokrotne kliknięcia).
5. Przetestuj adversarial (SQL injection, XSS, długie inputy, wygasła sesja, podszycie pod inny terminal, manipulacja ID).
6. Sprawdź czy mock i realny adapter są osobno zaimplementowane.
7. Sprawdź brak sekretów i hardkodowanych danych dostępowych.
8. Podaj wynik: approve / request changes / comment z listą znalezionych problemów.
