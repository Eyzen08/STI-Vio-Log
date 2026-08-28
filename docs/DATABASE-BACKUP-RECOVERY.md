# Database backup and recovery runbook

## Objective

Protect STI Vio-Log records with encrypted, access-controlled PostgreSQL backups and regularly prove that they can be restored. A backup is not considered valid until both archive verification and a separate-database restore test succeed.

## Production policy

- Enable the database provider's automated daily backups and point-in-time recovery when available.
- Retain daily backups for 14 days, weekly backups for 8 weeks, and monthly backups for 12 months, subject to the school's retention policy.
- Keep at least one encrypted copy outside the primary database account or region.
- Restrict backup access to named system administrators. Never place dumps in Git, Vercel artifacts, chat, email, or a public file share.
- Record each backup/restore drill in the operational log without recording database passwords or student data.

## Create and verify a manual archive

Install PostgreSQL client tools matching the production major version. From `backend`:

```powershell
npm run backup
npm run backup:verify -- "..\backups\sti-vio-log-<timestamp>.dump"
```

The backup command reads the existing `DATABASE_URL` or `DB_*` environment variables and passes credentials through the child-process environment, not command-line arguments. Archives default to `backups/`, which Git ignores. `BACKUP_DIR` may point to an approved encrypted storage mount. `BACKUP_FILE` may contain only a simple `.dump` filename.

## Restore drill

Never test a restore over the production database.

1. Create a new, empty, access-restricted PostgreSQL database dedicated to the drill.
2. Verify the archive with `npm run backup:verify -- <archive>`.
3. Restore with the provider's restore feature or PostgreSQL tooling:

```powershell
pg_restore --exit-on-error --no-owner --no-privileges --dbname=<NEW_RESTORE_TEST_DATABASE> <archive.dump>
```

4. Configure a temporary backend instance to use the restored database.
5. Run `npm run migrate:status`, the backend tests, and role-based smoke tests without sending notifications to real users.
6. Compare table counts and recent audit records with the backup source at the recorded cutoff time.
7. Destroy the temporary database through the provider console after the drill and record the outcome.

## Incident recovery

During a real incident, stop writes or place the service in maintenance mode, identify the required recovery point, preserve the damaged database for investigation, and restore into a new database first. Validate migrations and critical workflows before switching the backend connection. Rotate database credentials if compromise is suspected and document the recovery decision and data-loss window.

## Schedule

Run an archive verification after every manual backup and a full restore drill at least quarterly and before risky production migrations. Assign a named owner and backup owner so the procedure does not depend on one person.
