# Staging and Production Security Gate

## Environment separation

Provision five distinct configuration scopes: local, test, preview, staging, and production. Staging must use a separate Supabase project, Render service, Google OAuth client, Brevo sender/API key, cookie-signing material, and fake identities. Never copy production database URLs, service-role keys, mail keys, OAuth secrets, session keys, or backup keys into Vercel Preview or GitHub pull-request environments.

Required backend identity variables are `NODE_ENV=production`, `DEPLOYMENT_ENV=staging|production`, and a matching `DATABASE_ENVIRONMENT`. Startup intentionally fails when these identities are absent or disagree. Vercel must define server-side `API_PROXY_ORIGIN` separately in Preview, Staging, and Production; define `PRODUCTION_API_ORIGIN` everywhere so non-production builds fail if they point at production.

Only synthetic accounts and records are permitted in staging. Use clearly fictional names and `example.test` email addresses. Confirm the staging database host/project reference differs from production before migrations and before every restore.

## Migration procedure

1. Take an encrypted, integrity-checked backup using the documented backup command and store the key separately.
2. Apply migrations with a migration-only database credential using `npm run migrate` from `backend`.
3. Start the application with a separate login that is only a member of `sti_vio_log_runtime`.
4. Run `npm run production:check`. Migration credentials must not exist in the running Render service.
5. Exercise login, logout, Socket.IO reconnect, signature upload, clearance issuance, and negative authorization tests in staging.

Rollback is restore-based for data migrations: stop application writes, restore the encrypted pre-migration backup into a new isolated database, run verification, and switch the staging service only after approval. Do not hand-edit `schema_migrations` or reverse a migration against production.

## Provider owner checks

- Supabase: disable the Data API for this direct-Postgres application, keep `public` unexposed where supported, verify `anon`/`authenticated` have no grants, require verified TLS/approved CA, and confirm the runtime login has no owner, superuser, `BYPASSRLS`, `CREATEDB`, or `CREATEROLE` attributes.
- Vercel: scope variables per environment, protect preview deployments, expose no production source maps, and verify deployed CSP/cookie headers.
- Render: set an explicit trusted-proxy topology, minimum health response, separate staging service, and no migration/backup credential in runtime variables.
- Google/Brevo: use separate staging credentials and restricted redirect/sender settings.
- GitHub: protect `main`, require PRs and all security checks, block force-push/deletion, enable Dependabot, CodeQL, secret scanning and push protection, and do not expose secrets to fork workflows.

## Backup and privacy gate

Plaintext SQL dumps must not be tracked or stored in the repository or synchronized OneDrive tree. First create and verify an encrypted replacement in a restricted destination; then remove local plaintext copies using the operating system recycle bin. Record backup owner, retention, access log location, restore date, observed RTO, and observed RPO.

Before enabling public certificate verification, obtain written school approval for the remaining fields: certificate number, status, issue date, minimally displayed name, and masked student number. Program and completed hours are no longer returned. Record the approved retention schedule, named-administrator policy, and incident-response contacts.

## Production release decision

Production remains blocked until all repository checks pass and the provider checks above have signed evidence. There must be no unresolved confirmed critical/high issue; every medium issue needs remediation or an owner and due date; the five deployment-validation items in the audit must be resolved; and an encrypted restore drill must succeed.

Record evidence in `docs/security/SECURITY-AUDIT.md`: deployment IDs, dates, reviewer names, redacted screenshots/config exports, test run links, restore results, and approval references. Never place secrets or student data in evidence.
