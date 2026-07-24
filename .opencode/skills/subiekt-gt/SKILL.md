---
name: subiekt-gt
description: Use when working with Insert Subiekt GT ERP database via MSSQL MCP, querying Subiekt GT tables, or integrating with Sfera GT API. Covers safe read-only query patterns, table naming conventions (tw__, kh__, dok__, sl__, mag__, cen__), Sfera GT communication, ERP data protection rules. Triggers on: Subiekt GT, Sfera, MSSQL, ERP queries, Insert GT, warehouse ERP integration.
---

# Subiekt GT Integration

Ten skill dokumentuje bezpieczne wzorce pracy z bazą danych Insert Subiekt GT przez MSSQL oraz integrację z Sferą GT.

## Stan

[Do weryfikacji po audycie schematu] — skill zostanie rozwinięty podczas pierwszej implementacji integracji ERP.

## Główne obszary do udokumentowania

### Schemat bazy Subiekt GT

- Konwencje nazewnictwa tabel (`tw__Towar`, `tw_KodKreskowy`, `dok__Dokument`, `dok_Pozycja`, `kh__Kontrahent`, `sl__Slownik`, `mag__Magazyn`)
- Kluczowe kolumny dla odczytu stanów magazynowych
- Relacje między tabelami dokumentów i pozycji dokumentów
- Tabele słownikowe i ich znaczenie

### Bezpieczne odczyty

- Parametryzacja wszystkich zapytań (`@param`)
- Konto read-only
- Limity `TOP N` i timeout (max 30s)
- Unikanie blokowania ERP (NOLOCK gdzie bezpieczne)

### Sfera GT

- [Wymaga decyzji: dostępność Sfery GT w środowisku]
- Endpointy dla operacji magazynowych
- Mapowanie odpowiedzi na modele domenowe

## Narzędzia dostępne

- `mssql_execute_sql` — bezpośrednie zapytania SQL
- `insert-gt` MCP — wyszukiwanie schematu, obiektów i join path
