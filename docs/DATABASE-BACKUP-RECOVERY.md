# Encrypted database backup and recovery

## Policy

Supabase automated backups and point-in-time recovery are the primary production controls. Manual copies must be AES-256-GCM authenticated archives, restricted to named administrators, and stored outside the repository, OneDrive, Vercel artifacts, chat, email, and public shares. Retain daily copies for 14 days, weekly copies for 8 weeks, and monthly copies for 12 months unless the school policy requires otherwise.

## Required settings

- `BACKUP_DIR`: an explicit absolute private directory outside this repository and outside OneDrive.
- `BACKUP_ENCRYPTION_KEY`: exactly 32 random bytes encoded as Base64, held in a password manager or secret manager separately from the archives.
- `DATABASE_URL` or the individual `DB_*` settings, using verified TLS in production.

Never print or commit these values. Losing the encryption key makes the archive unrecoverable.

## Create and verify

From `backend`, with PostgreSQL client tools installed:

```powershell
npm run backup
npm run backup:verify -- "C:\private-backups\sti-vio-log-<timestamp>.dump.enc"
```

The script creates only a `.dump.enc` AES-256-GCM archive in `BACKUP_DIR`. A plaintext intermediate is created with restrictive permissions in the OS temporary directory and removed even on failure. Verification authenticates and decrypts to a temporary file, runs `pg_restore --list`, then removes the temporary file.

## Existing plaintext dumps

Do not delete an old `.dump` or `.sql` until all of these are true:

1. Its exact source path is confirmed.
2. It is encrypted into the approved private `BACKUP_DIR` with the separately stored key.
3. `npm run backup:verify -- <encrypted-file>` succeeds.
4. It restores successfully into a new isolated Supabase project or local PostgreSQL database.
5. Table counts and required audit records match the source cutoff.

Only then remove the plaintext originals and empty the applicable recycle bin/sync-provider retention area according to policy. Record filenames, times, operators, and results—never credentials or student contents.

## Restore drill

Never restore over production. Decrypt only on a restricted workstation into a temporary path, restore with `pg_restore --exit-on-error --no-owner --no-privileges`, run migrations/status and role-based smoke tests, compare recorded counts, and destroy the isolated restore database afterward. Perform a full drill quarterly and before risky production migrations.

## Incident recovery

Stop writes, preserve the affected database for investigation, identify the required recovery point, restore into a new database, validate critical workflows, then switch connections. Rotate database and application keys when compromise is suspected and document the data-loss window and decision owner.
