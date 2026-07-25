# Backup & Restore System — PomagierGT

## Overview
Automated backup system for Postgres + configuration + certificates with S3 remote storage and admin panel management.

## Data Sources to Backup
| Source | Source Path | Type |
|---|---|---|
| Postgres DB | Docker container `pomagier-db` | `pg_dump` SQL |
| .env config | `/pomagier/.env` | Plain file |
| TLS certs | `/root/certs/` + `/etc/caddy/certs/` | PEM files |

## Architecture
```
Cron (daily 3:00) → backup.sh
  ├── pg_dump pomagier-db → pomagier_YYYY-MM-DD_HHMM.sql
  ├── tar .env + certs
  ├── gzip
  ├── save to /backups/local/ (7-day retention)
  └── upload to S3 (30-day retention)
```

## Admin UI (`/admin/backup`)
Three tabs:

### Tab 1: Konfiguracja S3
- Form fields: Endpoint, Bucket, Region, Access Key, Secret Key
- "Test connection" button
- Saved to Postgres `config` table (AES-256 encrypted)

### Tab 2: Backupy
- Table: filename, size, date, source (local/S3)
- "Wykonaj backup teraz" button
- Download button per backup
- Delete button per backup

### Tab 3: Przywracanie
- Upload `.sql.gz` file OR select from backup list
- "Przywróć" button with confirmation dialog ("Wpisz TAK aby potwierdzić")
- Overwrites current `pomagier` database

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/backup/config` | GET | Read S3 config (mask secret keys) |
| `/api/backup/config` | PUT | Save S3 config |
| `/api/backup/run` | POST | Execute backup now (returns filename) |
| `/api/backup/list` | GET | List local + remote backups |
| `/api/backup/download/:name` | GET | Download backup file |
| `/api/backup/:name` | DELETE | Delete backup (local + S3) |
| `/api/backup/restore` | POST | Restore from uploaded file |

## Files
| File | Action |
|---|---|
| `scripts/backup.sh` | New — daily backup script |
| `scripts/restore.sql` | New — restore helper |
| `src/lib/backup-s3.ts` | New — S3 upload/download/list/delete helpers |
| `src/lib/backup-crypto.ts` | New — AES-256 encrypt/decrypt S3 secrets |
| `src/api/server.ts` | Add 7 backup endpoints |
| `src/routes/admin.backup.tsx` | New — admin backup page |
| `scripts/setup-prod.sh` | Add cron job + backup dirs |

## Dependencies
- `@aws-sdk/client-s3` — S3-compatible client

## Security
- S3 secrets AES-256 encrypted in `config` table
- `.env` excluded from backup if it contains `{{PLACEHOLDERS}}`
- Restore requires typing "TAK" confirmation
- Backup directory permissions: 700 root only

## Retention
- Local: 7 days (auto-cleanup)
- S3: 30 days (auto-cleanup via lifecycle policy optional)

## Success Criteria
- [ ] cron runs daily without errors
- [ ] `/admin/backup` shows backups from local and S3
- [ ] Restore from SQL file works and preserves data integrity
- [ ] S3 config can be changed and tested from admin UI
- [ ] Backup script handles errors gracefully (runs even if S3 unreachable, stores locally)
