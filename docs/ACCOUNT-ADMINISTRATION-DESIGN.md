# Account administration and recovery design

## Scope and security boundary

This design must be implemented before staff accounts are provisioned through the application. Account administration is restricted to authenticated, active `ADMIN` users. `DISCIPLINE_OFFICE`, `DEPARTMENT_HEAD`, and `STUDENT` users cannot create accounts, change roles, assign departments, deactivate users, reset credentials, or recover Google links.

The first implementation remains intentionally narrow:

- create individually attributable staff accounts;
- list accounts without returning credential material;
- activate and deactivate accounts;
- assign the existing application roles;
- map `DEPARTMENT_HEAD` accounts to one active department;
- review Google-authenticated department-officer requests and confirm their official department mapping;
- require a password change after initial credential delivery or recovery;
- recover a student Google link through an explicit, reasoned workflow;
- retain immutable audit history.

Bulk import, account deletion, silent merging, self-service password reset, emailed reset links, and granular custom permissions are deferred.

## Data model changes

Add an account-security migration rather than editing an applied migration.

### Users

Extend `users` with:

- `must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
- `session_version INTEGER NOT NULL DEFAULT 1`;
- `password_changed_at TIMESTAMPTZ`;
- `deactivated_at TIMESTAMPTZ`;
- `deactivated_by BIGINT REFERENCES users(id)`.

Every application JWT contains the current `session_version`. Authentication compares the claim with the active database account. Password reset, role change, and deactivation increment the version so previously issued sessions stop working immediately. React persistence remains only the application JWT and its non-sensitive user summary.

### Google link recovery

Google links must not be deleted to make relinking possible. Extend `google_identity_links` with:

- `revoked_at TIMESTAMPTZ`;
- `revoked_by BIGINT REFERENCES users(id)`;
- `revocation_reason TEXT`;

Replace the current unconditional uniqueness constraints with partial unique indexes applying only where `revoked_at IS NULL`. Historical subjects and email snapshots remain private and queryable only for security investigation. Recovery revokes the active row; it never creates a new link or authenticates the student. The student must complete the normal Google linking flow again.

### Audit integrity

Account actions use the existing `audit_logs` table and stable actions:

- `ACCOUNT_CREATE`;
- `ACCOUNT_ACTIVATE`;
- `ACCOUNT_DEACTIVATE`;
- `ACCOUNT_ROLE_CHANGE`;
- `ACCOUNT_DEPARTMENT_CHANGE`;
- `ACCOUNT_PASSWORD_RESET`;
- `ACCOUNT_PASSWORD_CHANGE`;
- `GOOGLE_LINK_REVOKE`.

Audit descriptions may contain local record IDs, old/new role or department IDs, the required reason, outcome, and allowed request metadata. They must never contain passwords, password hashes, JWTs, Google credentials, Google subjects, or full Google email addresses.

## Credential lifecycle

The server generates initial and recovery passwords with a cryptographically secure random generator. Only a bcrypt hash is stored. The plaintext value may be returned exactly once over HTTPS to the initiating administrator for delivery through the school's approved out-of-band channel; it is never written to logs, audit details, notifications, migrations, seed data, or later API responses.

New and reset accounts have `must_change_password = TRUE`. Login may issue a short-lived, restricted application token marked `password_change_required`. That token can call only the current-account password-change endpoint and logout-equivalent client cleanup. All other protected routes reject it with a stable `PASSWORD_CHANGE_REQUIRED` error.

Changing a password requires the temporary/current password, validates the new password policy, prevents reuse of the current password, clears `must_change_password`, records `password_changed_at`, and increments `session_version`. A normal session is issued only after successful change.

No shared account may be created for the Discipline Office or a scanning location. Every human operator receives an individual identity.

Department officers may use the pending Google workflow defined in `docs/DEPARTMENT-GOOGLE-IDENTITY-DESIGN.md`. Public registration cannot assign a role or department. Only `ADMIN` approval may create the `DEPARTMENT_HEAD` account and database-derived department mapping.

## Authorization and invariants

The backend enforces all invariants transactionally:

1. Only `ADMIN` may use account-administration routes.
2. Usernames are normalized for comparison and remain unique.
3. A `DEPARTMENT_HEAD` must have exactly one active department mapping before activation.
4. Non-department roles cannot retain a `department_heads` mapping.
5. A pending Google department registration is not a user and has no application permissions.
6. Student accounts are created only through the enrollment-gated student workflow; generic staff creation cannot assign `STUDENT`.
7. An administrator cannot deactivate or demote their own active session.
8. The last active `ADMIN` cannot be deactivated or changed to another role.
9. Deactivation and role/department changes lock the target row and invalidate all existing sessions.
10. Account and Google-link records are never hard-deleted by application workflows.
11. Duplicate-account review is read-only until an explicit, history-preserving resolution design exists.

Checks for the last active administrator and target state occur inside the same transaction with locked rows so concurrent requests cannot remove all administrators.

## API contract

All administration endpoints require `authenticateToken` and `authorizeRoles('ADMIN')`. Bodies reject unknown fields.

### Accounts

- `GET /api/admin/accounts?page=&limit=&role=&status=&search=` returns paginated non-sensitive summaries. It omits password hashes, credential flags not needed by the UI, Google identity data, and guardian/student private details.
- `POST /api/admin/accounts` creates a non-student staff account from `username`, `role`, staff name fields, optional employee number/email, and `department_id` when the role is `DEPARTMENT_HEAD`. It returns the generated temporary password once in a separately named field.
- `PATCH /api/admin/accounts/:id/status` accepts only `is_active` and a required `reason`.
- `PATCH /api/admin/accounts/:id/assignment` accepts `role`, optional `department_id`, and a required `reason`.
- `POST /api/admin/accounts/:id/password-reset` accepts only a required `reason`, invalidates sessions, and returns a new generated temporary password once.
- `POST /api/account/password-change` accepts only `current_password` and `new_password` and is available to the authenticated account, including a password-change-required session.

### Departments

- `GET /api/admin/departments` lists department configuration and assigned-account counts.
- `POST /api/admin/departments` creates a department from a unique code, official name, and optional description.
- `PATCH /api/admin/departments/:id` updates allowed metadata or active state with a required reason. A department cannot be deactivated while active accounts remain assigned.

### Google recovery

- `POST /api/admin/students/:studentId/google-link/revoke` accepts only a required reason.
- A missing or already revoked link returns the same non-sensitive conflict response.
- The response confirms only the local student record and revocation result; it does not return Google identity claims.

## UI milestones

The system-admin shell gains Accounts, Departments, and Audit Log navigation. Account lists show status, role, department, forced-change state, and last relevant activity. Create, deactivate, reassignment, password-reset, and Google-recovery dialogs explain their effects and require confirmation/reasons where specified.

The one-time temporary password view must clearly state that it cannot be retrieved again. It must not place the value in a URL, browser storage, analytics, or console output. Closing the view removes it from React state.

Loading, empty, validation, conflict, forbidden, expired-session, and retry states must be accessible and responsive. Frontend role checks are presentation only; backend authorization remains authoritative.

## Required tests

- non-admin access is rejected for every administration endpoint;
- responses and logs never expose hashes, temporary passwords after creation/reset, JWTs, or Google identity values;
- staff creation, department mapping, activation, and deactivation are atomic and audited;
- generic staff creation rejects the `STUDENT` role;
- department accounts cannot activate without one active department;
- self-deactivation/self-demotion and last-admin removal are rejected under concurrent requests;
- password reset and role/status changes invalidate old JWTs through `session_version`;
- forced-change sessions cannot reach normal protected endpoints;
- temporary/current password is required for password change and the new password cannot reuse it;
- Google recovery revokes rather than deletes history and requires the normal student linking flow afterward;
- simultaneous Google recovery/linking attempts have one deterministic outcome;
- inactive departments with assigned active accounts are rejected;
- existing username/password and Google student authentication remain functional;
- frontend confirmation, cancellation, one-time-secret cleanup, loading, error, and accessibility states pass contract-focused tests.

## Implementation order

1. [x] Account-security and recoverable-Google-link migration with upgrade tests.
2. [x] Session-version and forced-password-change authentication enforcement.
3. [x] Transactional staff-account administration services and audit events.
4. [x] Admin-only account routes with validation, pagination, and stable errors.
5. [ ] Role-aware system-admin accounts, departments, and audit frontend. (Accounts UI complete; Departments and Audit Log remain.)
6. [ ] Full backend, frontend, migration, and integration verification.
7. [ ] Provision named school accounts through the verified workflow; never through committed seed credentials.
