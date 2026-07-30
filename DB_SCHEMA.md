# DB Schema — PomagierGT

## Postgres (dane aplikacyjne)

### users
| Kolumna | Typ | Opis |
|---|---|---|
| id | uuid PK | |
| subiekt_uz_id | int UNIQUE | klucz do `pd_Uzytkownik.uz_Id` |
| pin | varchar(64) | bcrypt hash (10 rounds) |
| role | varchar(20) | admin / operator |
| active | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

### sessions
| Kolumna | Typ | Opis |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| token | text | JWT token |
| expires_at | timestamp | |
| created_at | timestamp | |

### config
| Kolumna | Typ | Opis |
|---|---|---|
| key | varchar(50) PK | np. `fieldmap_location`, `mssql_host` |
| value | text | |
| updated_at | timestamp | |

### locations
| Kolumna | Typ | Opis |
|---|---|---|
| id | uuid PK | |
| code | varchar(20) UNIQUE | "A 1-2-3-4" |
| area | varchar(5) | A, B... |
| aisle | int | Alejka |
| rack | int | Regał |
| shelf | int | Półka |
| spot | int | Miejsce (zawsze 1) |
| label | varchar(100) | "Obszar A, Alejka 1..." |
| created_at | timestamp | |

### product_locations
| Kolumna | Typ | Opis |
|---|---|---|
| id | uuid PK | |
| product_id | int | tw__Towar.tw_Id |
| location_id | uuid FK → locations | |
| quantity | int | |
| created_at | timestamp | |
| **UNIQUE** | (product_id, location_id) | |

### product_movements
| Kolumna | Typ | Opis |
|---|---|---|
| id | uuid PK | |
| product_id | int | tw__Towar.tw_Id |
| symbol | varchar(50) | tw_Symbol (historycznie) |
| name | varchar(100) | tw_Nazwa (historycznie) |
| from_location_id | uuid nullable | NULL = pierwsze przypisanie |
| to_location_id | uuid nullable | NULL = usunięcie |
| from_code | varchar(20) | |
| to_code | varchar(20) | |
| quantity | int | |
| operator | varchar(100) | |
| correlation_id | varchar(36) | |
| created_at | timestamp | |

### audit_log (gotowa, nieużywana w MVP)
| Kolumna | Typ |
|---|---|
| id | uuid PK |
| correlation_id | varchar(36) |
| user_id | uuid FK → users |
| action | varchar(50) |
| details | text |
| created_at | timestamp |

### products_cache (v1.6.0)

Szybki cache podstawowych danych produktów z Subiekta GT. Aktualizowany przy każdym skanie.

| Kolumna | Typ | Opis |
|---|---|---|
| id | int PK | tw_Id z Subiekta |
| symbol | varchar(50) | tw_Symbol |
| name | varchar(200) | tw_Nazwa |
| barcode | varchar(50) | tw_PodstKodKresk (EAN) |
| unit | varchar(10) | tw_JednMiary, domyślnie `szt` |
| updated_at | timestamp | ostatnia aktualizacja |

Indeksy: `idx_pc_barcode` na `barcode`, `idx_pc_symbol` na `symbol`.

## MSSQL Subiekt GT (read-only)

| Tabela | Kluczowe kolumny | Użycie |
|---|---|---|
| `tw__Towar` | tw_Id, tw_Symbol, tw_Nazwa, tw_PodstKodKresk, tw_JednMiary, tw_Pole1-8 | Towary, EAN, lokalizacje |
| `tw_Stan` | st_TowId, st_MagId, st_Stan, st_StanRez | Stany magazynowe |
| `sl_Magazyn` | mag_Id, mag_Symbol, mag_Nazwa | Magazyny |
| `pd_Uzytkownik` | uz_Id, uz_Imie, uz_Nazwisko, uz_Status | Operatorzy |
| `vwFeniksFirmaSync` | adr_NazwaPelna, adr_NIP, pd_Regon | Dane firmy |
| `uf_SynchroKodyKresk` | usk_Kod, usk_IdSynchronizacja | Kody kreskowe |
