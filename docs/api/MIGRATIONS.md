# Database migrations

Migrations live in `database/migrations`, use ordered numeric filenames, and are tracked in `schema_migrations`. The runner takes a PostgreSQL advisory lock, applies each pending file in its own transaction, records it only after success, stops at the first failure, and closes its connection. It never drops or wipes application data.

## Commands

From `backend`:

```text
npm run migrate:status
npm run migrate
npm test
npm run test:migrations
```

`migrate:status` shows applied/pending files. A second `migrate` is idempotent.

## Environment

Use either `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. Configure `DB_SSL=disable`, `require`, or `no-verify` according to the provider. `JWT_SECRET` must be at least 32 characters. Never commit real secrets.

## Deployment procedure

1. Back up the production database and verify restoration procedures.
2. Configure production environment variables.
3. Run `npm run migrate:status`.
4. Run `npm run migrate`; stop deployment if it fails.
5. Start or restart the backend.
6. Call `GET /api/health` and require HTTP 200 with database `connected`.
7. Smoke-test login, a protected read, and the critical DTR flow.

This procedure does not claim zero-downtime migration support. Disposable integration tests use guarded `sti_vio_log_test_*` schemas and never wipe the configured development schema.

Migration `005_google_identity_links.sql` adds only the identity-link storage foundation. Its independent unique constraints prevent one local user from linking multiple Google subjects and prevent one Google subject from linking multiple users, including under concurrent inserts. Applying it does not enable Google login or require Google credentials.

Migration `019_student_password_auth.sql` adds email-verification state, pending Student password registrations, hashed single-use OTP records, and hashed short-lived password-reset authorizations. Existing user accounts are marked verified to preserve access. New Student password accounts are created only after successful OTP verification.

Migration `020_student_password_registration_profile.sql` extends pending Student registrations with separate identity, contact, academic, and guardian fields. OTP verification uses these fields to create a complete Student profile and primary guardian record. The new columns remain nullable so registrations started before the migration can still be verified safely.

Migration `021_message_department_scope.sql` adds an explicit optional department assignment to official conversations. Existing conversations remain scoped to the Discipline Office. Department Heads can access only conversations explicitly assigned to their authenticated department.
