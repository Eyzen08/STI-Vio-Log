# Administrator security model

STI Vio-Log uses `DISCIPLINE_ADMIN` as its single administrator role. It owns institutional operations and the protected technical-monitoring tools formerly assigned to `SYSTEM_ADMIN`. `DISCIPLINE_OFFICE`, `DEPARTMENT_HEAD`, and `STUDENT` retain their scoped operational or self-service access.

The backend permission matrix in `backend/src/security/permissions.js` is authoritative. Frontend route and control visibility is only a usability layer. Protected requests re-read current account state, session version, and permissions from the database.

## Administrator access

Discipline Administrators can use the normal operational dashboard and the separate `/admin/system-monitoring` page in the same authenticated session. System Monitoring exposes sanitized health, authentication activity, security events, account targeting, locking, and controlled recovery. It never exposes secrets, raw environment configuration, arbitrary SQL, or impersonation.

Every Discipline Administrator uses an individual account and must enroll in TOTP MFA. Switching dashboards and reading monitoring data do not require another challenge after login. The privileged session uses the shorter administrator idle timeout.

## Protected account actions

Account lock and recovery require the signed-in Discipline Administrator to confirm the current password. Successful confirmation creates a five-minute, single-use token bound to the registered action, target account, and target session version. Execution rejects an expired or replayed token, a changed target, self-locking, self-recovery, and removal of the last active Discipline Administrator.

Each execution records sanitized before/after summaries and the underlying account change creates its normal audit entry. Passwords, password hashes, MFA values, tokens, and generated recovery credentials are never written to audit storage.

## Retired workflows and migration

Migration 037 converts every `SYSTEM_ADMIN` account to `DISCIPLINE_ADMIN`, increments its session version, and preserves its ID, profile, MFA enrollment, references, and audit ownership. PostgreSQL retains `SYSTEM_ADMIN` and `ADMIN` only as historical enum labels; the application no longer authorizes or creates either role.

Temporary support access and two-person action approval are retired because the unified administrator already has the required standing permissions. Existing support-access and high-risk request tables remain for history. Migration 037 revokes open support grants and cancels pending or approved legacy high-risk requests without deleting records.

## Production checklist

1. Apply migrations in numeric order and confirm migration 037 is recorded.
2. Confirm no active user retains `SYSTEM_ADMIN` or legacy `ADMIN`.
3. Confirm at least one active `DISCIPLINE_ADMIN` exists before disabling bootstrap.
4. Confirm converted administrators must authenticate again and complete MFA.
5. Test both dashboards, direct password-confirmed lock/recovery, stale-target rejection, notifications, and audit visibility.
6. Maintain HTTPS, least-privilege database credentials, protected secrets, monitoring, and tested encrypted backups.
