# Database Schema — PomagierGT

## Stan: [Do weryfikacji po audycie]

Schemat bazy aplikacyjnej PomagierGT zostanie zaprojektowany po:

1. Wyborze technologii backendu
2. Decyzji o silniku bazy danych (Postgres? SQLite? [Wymaga decyzji])
3. Ustaleniu zakresu pierwszej iteracji

## Baza aplikacyjna vs MSSQL Subiekta

Baza PomagierGT **nie zastępuje** MSSQL Subiekta GT. Przechowuje wyłącznie dane aplikacji:

- Użytkownicy
- Role i uprawnienia
- Terminale
- Konfiguracja (niebędąca sekretem)
- Zadania i statusy
- Kolejka synchronizacji
- Historia operacji
- Log audytowy
- Mapowania lokalizacji
- Dane potrzebne do pracy offline

## Konwencje nazewnictwa

[Do ustalenia przy projektowaniu schematu]
