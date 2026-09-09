# Administrator security model

STI Vio-Log separates technical maintenance from institutional operations. `SYSTEM_ADMIN` and `DISCIPLINE_ADMIN` are individual, non-inheriting roles; neither is a superuser role.

## Responsibility boundaries

- `SYSTEM_ADMIN` can inspect sanitized system status, authentication activity, and append-only security events; lock accounts; initiate controlled recovery; and request narrowly scoped temporary support access. It has no standing access to student discipline, guardian, private-message, attendance, service, clearance, certificate, or e-signature operations.
- `DISCIPLINE_ADMIN` owns student and institutional workflows, operational staff accounts, reports, exports, and approval of temporary support access. It cannot read secrets, raw environment configuration, or use developer maintenance controls.
- `DISCIPLINE_OFFICE`, `DEPARTMENT_HEAD`, and `STUDENT` retain their scoped operational or self-service access.

The backend permission matrix in `backend/src/security/permissions.js` is authoritative. Frontend route and control visibility is only a usability layer. Protected requests re-read current account state, session version, permissions, and any temporary grant from the database.

## Administrator lifecycle

Use the disabled-by-default bootstrap described in `administrator-bootstrap.md` for the first account of each administrator role. Every administrator must have an individual account. Production credentials must never be committed or placed in seed data.

Locking, recovery, password changes, and role conversion increment the account session version. Existing tokens consequently stop working. Self-locking, self-role changes, and removal of the last active administrator of either protected role are rejected using transactional locks.

## Temporary support access

Technical support access is read-only, exact-scope, approved by a different active `DISCIPLINE_ADMIN`, and bounded by database timestamps. Grant state is checked on every protected request. Approval, use, revocation, and automatic expiry are audited and generate deduplicated security notifications. Access never impersonates another user.

Temporary write elevation and emergency break-glass access are intentionally **not implemented**. They must not be represented by a frontend-only control. Before either feature is introduced, it requires recent re-authentication, exact operation scopes, short expiry, explicit approval, durable alerts, post-event review, and complete automated tests. Break-glass must also require MFA once a fully tested MFA lifecycle exists.

## Auditing and notifications

Administrative security events are append-only and use database-generated IDs and timestamps. Application roles are denied update/delete access by migration. Logged details are recursively redacted and must never contain passwords, hashes, OTPs, tokens, credentials, secrets, message bodies, or unnecessary personal data.

Security notifications have severity, event-key deduplication, and explicit acknowledgement. A notification delivery failure does not grant access or undo an authorization decision. Normal API rate limiting and the dedicated authentication/recovery limits remain mandatory in production.

## Migration and recovery

Apply migrations in numeric order. Migrations 028–032 add the roles, convert legacy operational `ADMIN` accounts to `DISCIPLINE_ADMIN`, create temporary support access, harden the audit stores, and add security notifications. IDs, password hashes, ownership references, and history remain unchanged.

Post-migration checks:

1. Confirm no active user retains the legacy `ADMIN` role.
2. Confirm at least one active `SYSTEM_ADMIN` and one active `DISCIPLINE_ADMIN` exist before retiring bootstrap access.
3. Confirm converted accounts have a newer session version and must authenticate again.
4. Confirm the normal application database role cannot update or delete either audit table.
5. Run the backend and frontend test suites plus the production configuration check.

Do not reverse the conversion by deleting accounts or historical rows. If deployment must be rolled back, keep the expanded enum and new tables/columns, deploy the preceding compatible application version, and restore service from a verified pre-deployment backup only if data integrity is affected. PostgreSQL enum values should not be removed in place.

## Production checklist

- Configure strong JWT and certificate signing secrets through the deployment secret manager.
- Use HTTPS-only explicit origins and a least-privilege PostgreSQL application account.
- Run migrations before accepting traffic and verify the migration ledger.
- Bootstrap each initial administrator once, rotate the temporary password, then disable bootstrap.
- Test login, role routing, account lock/recovery, support approval/expiry/revocation, notifications, and audit visibility.
- Monitor denied/failed authentication events and unacknowledged critical security notifications.
- Maintain tested encrypted backups and document the institutional incident-response contact.
