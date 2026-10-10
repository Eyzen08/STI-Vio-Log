# Database migrations

Migrations live in `database/migrations`, use ordered numeric filenames, and are tracked in `schema_migrations`. The runner takes a PostgreSQL advisory lock, applies each pending file in its own transaction, records it only after success, stops at the first failure, and closes its connection. The runner itself does not reset the database; individual SQL files can transform, redact or clean up data and must be reviewed before application.

## Commands

From `backend`:

```text
npm run migrate:status
npm run migrate
npm test
npm run test:migrations
npm run test:violation-integration
```

`migrate:status` shows applied/pending files but creates `schema_migrations` if absent, so it is not unconditionally read-only. A second migrate applies no already-recorded filenames; there are no file-content checksums.

## Environment

Use either `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for normal runtime and migration operations. PostgreSQL integration suites additionally require an explicit `TEST_DATABASE_URL` pointing to a separate test database; the suites refuse a URL matching `DATABASE_URL`, `MIGRATION_DATABASE_URL`, or the legacy runtime database settings. Use DB_SSL=disable only locally; production requires verified TLS (`require` plus appropriate CA where needed), and rejects no-verify. MIGRATION_DATABASE_URL takes precedence for migration commands and must be separate from the runtime login. Never commit real secrets.

## Deployment procedure

1. Back up the production database and verify restoration procedures.
2. Configure production environment variables.
3. Run `npm run migrate:status`.
4. Run `npm run migrate`; stop deployment if it fails.
5. Start or restart the backend.
6. Call `GET /api/health` and require HTTP 200 with database `connected`.
7. Smoke-test login, a protected read, and the critical DTR flow.

This procedure does not claim zero-downtime migration support. Disposable integration tests use guarded `sti_vio_log_test_*` schemas inside the dedicated `TEST_DATABASE_URL` database and remove them afterward.

Migration `005_google_identity_links.sql` adds only the identity-link storage foundation. Its original uniqueness is superseded by migration 008 partial active-link indexes; one active user/subject mapping is allowed while revoked history is retained. Applying it does not enable Google login or require Google credentials.

Migration `019_student_password_auth.sql` adds email-verification state, pending Student password registrations, hashed single-use OTP records, and hashed short-lived password-reset authorizations. Existing user accounts are marked verified to preserve access. This describes the historical public signup foundation. Public creation routes are now retired; new student accounts are staff-issued and complete mandatory Gmail/Google/profile onboarding.

Migration `020_student_password_registration_profile.sql` extends pending Student registrations with separate identity, contact, academic, and guardian fields. OTP verification uses these fields to create a complete Student profile and primary guardian record. The new columns remain nullable so registrations started before the migration can still be verified safely.

Migration `021_message_department_scope.sql` adds an explicit optional department assignment to official conversations. Existing conversations remain scoped to the Discipline Office. That former access model is retired. Department Accounts have no current messaging access; assignment values remain historical only.

Migration `022_unified_department_officers.sql` adds a department type and an optional department relationship to Discipline Office staff profiles. This supports the atomic Admin workflow that creates a department and its accountable officer together while preserving existing Department Head relationships.

Migration `023_admin_account_profiles.sql` adds administrator identity and verified recovery-email records, extends the existing hashed OTP store for Admin email verification, and records the latest successful account login timestamp.

Migration `024_clearance_certificates.sql` adds managed Discipline Officer e-signatures, immutable PDF certificate snapshots, certificate versions and revocation state, selected-signature snapshots, and email-delivery status. Issued snapshots are retained by application behavior; corrections require revocation and a new version. No institutionally approved permanent retention policy was found.

Migration `025_offense_escalation_incident_time.sql` adds optional incident time without changing historical incident dates, plus one derived offense-status row per student. The temporary policy scope is `ALL_HISTORY` because the application has no authoritative academic-term relation for violations. Invalid/cancelled records are excluded; completed and cleared records remain part of retained history. Source violation severities are never rewritten.


Migration `043_student_academic_strands.sql` adds nullable `strand` (ABM/STEM) to students and adds `academic_level` and `strand` to pending password and Google registrations. Missing levels are inferred from year/grade without changing historical program values or student access. Apply it before the backend release.


## College and Senior High School support

The system supports College programs (years 1-4 for new academic submissions) and Senior High School **ABM** (Accountancy, Business, and Management) and **STEM** (Science, Technology, Engineering, and Mathematics), Grades 11-12. SHS requires a strand and section instead of a College program. Both modes retain the same Student role and authorization rules. See the [student academic model](../STUDENT-ACADEMIC-MODEL.md) for account setup, audited corrections, API fields, historical records, migration 043, and acceptance examples.

## Current coverage and execution

October 10, 2026: **50 tracked migrations, 001–050**, and all 50 filenames observed in the matched Supabase tracking metadata. Fresh/legacy migration execution passed on a disposable PostgreSQL 18.6 cluster; the complete integration run passed 48/49 because the academic test expects only 043 rather than 043–050. No shared-environment migration was run. [Testing](../TESTING.md) records exact scope. This supersedes older 41/43 migration checkpoints without erasing their release history.

| Migration | Area |
|---|---|
| `001_initial_schema.sql` | initial schema |
| `002_violation_lifecycle.sql` | violation lifecycle |
| `003_service_clearance_sync.sql` | service clearance sync |
| `004_community_service_sessions.sql` | community service sessions |
| `005_google_identity_links.sql` | google identity links |
| `006_google_student_registrations.sql` | google student registrations |
| `007_google_department_registrations.sql` | google department registrations |
| `008_account_security.sql` | account security |
| `009_staff_profiles.sql` | staff profiles |
| `010_handbook_violation_categories.sql` | handbook violation categories |
| `011_student_registration_profile.sql` | student registration profile |
| `012_parent_contact_logs.sql` | parent contact logs |
| `013_service_assignment_department.sql` | service assignment department |
| `014_event_notifications.sql` | event notifications |
| `015_enrollment_verification.sql` | enrollment verification |
| `016_secure_messaging.sql` | secure messaging |
| `017_discipline_student_record_review.sql` | discipline student record review |
| `018_service_result_review.sql` | service result review |
| `019_student_password_auth.sql` | student password auth |
| `020_student_password_registration_profile.sql` | student password registration profile |
| `021_message_department_scope.sql` | message department scope |
| `022_unified_department_officers.sql` | unified department officers |
| `023_admin_account_profiles.sql` | admin account profiles |
| `024_clearance_certificates.sql` | clearance certificates |
| `025_offense_escalation_incident_time.sql` | offense escalation incident time |
| `026_officer_responsibility.sql` | officer responsibility |
| `027_google_registration_identity_names.sql` | google registration identity names |
| `028_administrator_role_separation.sql` | administrator role separation |
| `029_convert_legacy_administrators.sql` | convert legacy administrators |
| `030_temporary_support_access.sql` | temporary support access |
| `031_administrative_audit_hardening.sql` | administrative audit hardening |
| `032_security_notifications.sql` | security notifications |
| `033_high_risk_actions.sql` | high risk actions |
| `034_session_mfa_hardening.sql` | session mfa hardening |
| `035_function_search_path_hardening.sql` | function search path hardening |
| `036_database_retention_maintenance.sql` | database retention maintenance |
| `037_merge_system_administrator.sql` | merge system administrator |
| `038_student_mandatory_onboarding.sql` | student mandatory onboarding |
| `039_student_google_email_confirmation.sql` | student google email confirmation |
| `040_data_api_lockdown.sql` | data api lockdown |
| `041_attendance_outcomes.sql` | attendance outcomes |
| `042_student_academic_level.sql` | student academic level |
| `043_student_academic_strands.sql` | student academic strands |
| `044_account_avatars.sql` | account avatars |
| `045_service_hour_corrections.sql` | service hour corrections |
| `046_service_session_duration.sql` | service session duration |
| `047_notification_record_targets.sql` | notification record targets |
| `048_student_account_activation_security.sql` | student account activation security |
| `049_office_attendance_notifications.sql` | office attendance notifications |
| `050_terms_acknowledgments.sql` | terms acknowledgments |

Each file was inventoried/reviewed for schema changes; ordering, grants, historical transforms and guarded test behavior were inspected. Applied-name metadata does not verify that stored historical file contents match this checkout. Runtime grants, chronology, date/concurrency and retention limitations are described in [the data architecture](../TECH_STACK.md). Migration 050 acknowledgment enforcement remains disabled in application configuration.
