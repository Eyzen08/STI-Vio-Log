# Department officer Google registration design

## Decision

Department access belongs to an individually identified officer, never to a shared account named after a location such as Library or School Guard. A department officer may register with Google, but registration creates only a pending request. Only an authenticated `ADMIN` may approve the officer, choose or confirm the official department, and grant the `DEPARTMENT_HEAD` role.

Pending, rejected, inactive, or unlinked applicants cannot access QR scanning, student information, DTR, service assignments, non-compliance information, or department reports.

## Separate authentication entry points

The frontend will separate the audiences clearly:

```text
/login                 Account-type chooser and existing staff password login
/student/login         Student Google sign-in and enrollment-gated registration
/department/login      Approved department-officer Google sign-in
/department/register   New department-officer Google registration
```

Student registration asks for a student number and student name. Department registration must not ask for a student number and instead asks for:

- officer first name;
- officer last name;
- employee number, when the school issues one;
- department type;
- official department name;
- optional registration note for the reviewer.

Suggested controlled department types are `LIBRARY`, `SCHOOL_GUARD`, `STAFF_OFFICE`, and `OTHER`. The displayed official department name remains separate from the controlled type. Selecting `OTHER` never creates a department automatically; the Admin must confirm the official name and configuration during approval.

## Google identity boundary

The browser obtains a Google ID token through Google Identity Services and sends it to the backend over HTTPS. The backend verifies signature, audience, issuer, expiry, stable `sub`, and verified-email state. The Google `sub` is the only external identity key. Names entered by the applicant and Google profile/display names are not trusted as authorization evidence.

No Google credential, application JWT, Google subject, or password material may be logged or returned in a review queue. A single Google subject cannot have simultaneous student and department registrations and cannot link to more than one local user.

## Pending data model

Add `google_department_registrations` in a new migration with:

```text
id
google_subject
google_email
officer_first_name
officer_last_name
employee_number
requested_department_type
requested_department_name
applicant_note
status                    PENDING | APPROVED | REJECTED
review_reason
reviewed_by
reviewed_at
created_at
updated_at
```

Partial unique indexes prevent more than one `PENDING` request for the same Google subject or employee number. Application transactions also check `google_identity_links`, active student registration requests, users, department-head records, and existing employee numbers. Rejected requests remain as review history and are never silently deleted.

## Registration and login contracts

### `POST /api/auth/google/department/register`

This public, separately rate-limited endpoint accepts only:

```text
credential
officer_first_name
officer_last_name
employee_number          optional
department_type
department_name
applicant_note           optional
```

After Google verification and uniqueness checks, it returns HTTP 202 with a non-sensitive pending reference. It never creates a user, department mapping, Google link, QR-scanner permission, or session.

### `POST /api/auth/google/department/login`

This endpoint accepts only `credential`. It succeeds only when the Google subject is linked to an active `DEPARTMENT_HEAD` user with exactly one active department mapping. Department scope is loaded from the database and is never accepted from the client or trusted from a JWT claim.

### Review endpoints

```text
GET  /api/admin/google-department-registrations?status=PENDING
POST /api/admin/google-department-registrations/:id/approve
POST /api/admin/google-department-registrations/:id/reject
```

All review endpoints require `ADMIN`. Approval accepts an existing active `department_id`, confirmed officer fields, and a required reason. If a requested department does not exist, the Admin must create it through the separately authorized department-management workflow first.

Approval atomically:

1. locks the pending request;
2. rechecks Google-subject, employee-number, username, and department uniqueness/scope;
3. verifies the selected department is active;
4. creates an individually attributable `DEPARTMENT_HEAD` user with no usable password unless a separate password credential is intentionally issued;
5. creates the `department_heads` mapping;
6. creates the Google identity link;
7. marks the request approved;
8. records reviewer and account/link audit events;
9. commits without issuing a session to the reviewer or applicant.

The officer signs in with Google afterward to receive the normal role-scoped session. Rejection requires a reason, preserves the request, and creates no account.

## Required security rules

- A department name is organizational data, not an account identity.
- Every officer uses their own Google identity and local user ID.
- Registration never grants access before Admin approval.
- `DISCIPLINE_OFFICE` may not grant staff roles or department scope unless a future RBAC decision explicitly delegates that authority.
- Department type/name requested by an applicant is advisory until confirmed by Admin.
- Department Heads can access only their database-mapped department.
- Role, department ID, approval status, actor ID, and scanner permission are never accepted from the public registration body.
- Changing an approved officer's role or department uses the audited account-administration workflow and invalidates existing sessions.
- Google-link recovery follows the separately designed audited recovery workflow.

## Required tests

- student and department entry points submit different whitelisted contracts;
- invalid Google tokens and unverified email identities fail closed;
- pending registration returns no user, link, session, or department access;
- duplicate Google subject and employee number requests are deterministic under concurrency;
- a Google identity cannot register for both student and department access;
- non-admin review is rejected;
- approval requires an active existing department and a reason;
- approval creates one user, one department mapping, one Google link, and complete audit events atomically;
- rejection preserves history and creates no account;
- pending and rejected identities cannot log in;
- approved active officers can log in and are scoped exclusively to the mapped department;
- inactive officer accounts or departments cannot log in;
- no credential, Google subject, password hash, or JWT appears in logs or review responses;
- responsive and accessible student/department chooser, registration, pending, error, and reviewer states.

## Implementation order

1. [ ] Separate authentication chooser, Student entry, and Department entry contracts/routes.
2. [ ] Pending department-registration migration and cross-role concurrency tests.
3. [ ] Google department registration/login verifier service and rate-limited public routes.
4. [ ] Admin-only review service, department confirmation, approval/rejection, and audits.
5. [ ] Department registration/pending UI and Admin review queue.
6. [ ] Full backend, frontend, migration, RBAC, and live Google verification.
