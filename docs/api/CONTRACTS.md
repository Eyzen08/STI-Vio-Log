# Backend API contracts

All protected endpoints use `Authorization: Bearer <JWT>`. Successful responses retain the existing `success: true` envelope. Errors preserve `success: false` and `message` for compatibility and use the stable shape below where the endpoint has been migrated:

```json
{"success":false,"message":"Human-readable message","error":{"code":"VALIDATION_ERROR","message":"Human-readable message"}}
```

Standard statuses are 400 validation/business rules, 401 authentication, 403 authorization, 404 missing or non-visible resources, 409 concurrency/database conflicts, and 500 unexpected failures. Student self-service never accepts an ownership identifier; it derives ownership from the authenticated account. Private resources outside that ownership are treated as not visible (404) unless access is rejected at the role boundary (403).

## Canonical domain rules

- Violation statuses: `OPEN`, `COMPLETE`, `CLEAR`, `INVALID_CANCEL`.
- Violation actions: `COMPLETE`, `CLEAR`, `INVALID_CANCEL`, `REOPEN`. `CLEAR`, `INVALID_CANCEL`, and `REOPEN` require reasons. REOPEN always results in `OPEN`.
- Assignment states include `OPEN`, `IN_PROGRESS`, `COMPLETED`, `ADMIN_CLOSED`, and `INVALID_CANCELLED`.
- DTR session states are `ACTIVE` and `COMPLETED`. Clients never set timestamps, status, worked minutes, credited minutes, or actors.
- Integer minutes in completed sessions are authoritative. `worked_minutes` records actual duration; `credited_minutes` is capped at the requirement. Assignment `completed_hours` is a derived compatibility cache, not an independent source of truth.
- Legacy `community_service_attendance` events remain preserved. They are not automatically paired or counted in authoritative session totals because historical pairing can be ambiguous. New writes retain compatibility events alongside sessions.
- `CLEAR` administratively closes an assignment without deleting history. `INVALID_CANCEL` marks it invalid/cancelled without deletion. `REOPEN` reactivates remaining work when applicable.
- An `OPEN` violation or an `OPEN`/`IN_PROGRESS` assignment with remaining work blocks clearance. `COMPLETE`, `CLEAR`, and `INVALID_CANCEL` do not. All student violations are evaluated. `NOT_ELIGIBLE` means blocked, `PENDING` means eligible but awaiting approval, and `CLEARED` means approved.

Administrative DTR corrections are deliberately deferred. A future correction design must be authorized, reasoned, append-only or revision-based, and audited; it must never silently rewrite or delete session history.

## Student violation self-service

`GET /api/students/me/violations` accepts no query parameters and derives the student exclusively from the authenticated account. Each violation includes type code/name, severity, canonical lifecycle status, description, incident timestamps, authoritative required/completed/remaining service hours, and ordered lifecycle history. Student history exposes action, status transition, reason, actor role, and timestamp; actor user IDs and usernames are intentionally omitted.

`GET /api/violations/types` returns active violation classifications available to Admin and Discipline Office users. Handbook classifications are Minor and Major Categories A-D. Violation creation records only the offense and incident facts; it never accepts or automatically creates community-service hours.

`GET /api/community-service/assignment-options` returns only active departments with their active Department Heads to Admin and Discipline Office users. `POST /api/community-service` requires `violation_id`, `student_id`, `required_hours`, `department_id`, and `department_head_id`. The backend verifies that the open violation belongs to the student and that the selected head is active and assigned to the selected active department. Assignment lists preserve and return that accountable destination; historical assignments created before this contract may have no recorded destination.

QR attendance never accepts a client-selected scanner identity. `scanned_by` is always derived from the authenticated account. Admin and Discipline Office users choose only a configured active department; Department Heads are locked to their authenticated department. An “Other” destination must therefore be created as a real active department with an active Department Head before it becomes selectable.

`PUT /api/violations/{id}` permits Admin and Discipline Office users to edit supported case fields. Every update requires a non-empty `reason`, derives the actor from authentication, records the changed field names and reason in the audit log, and synchronizes required hours with the linked service assignment and clearance state. Required hours can only change while the violation is `OPEN`.

`GET /api/violations/student/{studentId}` is restricted to Admin and Discipline Office users and returns that student's violation history with classification metadata and bounded pagination. It accepts only `page` and `limit`; the response includes database-wide condition totals, handbook category counts, plus `total`, `returned`, and `hasMore` so the client can load complete detail history without relying on the general violation list.

Staff student creation accepts the Student Number directly and never accepts a client-selected `user_id`. The backend uses the validated `02000` plus six digits Student Number as the local account username, generates an unknown random password, and creates the user/profile relationship atomically. Students subsequently use the enrollment-gated Google linking workflow; no generated password is returned or logged.

## Department Head QR attendance

Department Heads may submit only `qr_code` and optional `notes` to `/api/qr/scan`, `/api/qr/time-in`, and `/api/qr/time-out`. Their actor and department are derived from the authenticated account. Client-supplied `scanned_by` or `department_id` fields are rejected. The frontend requires a successful `/api/qr/scan` confirmation for the current code before enabling attendance actions; the backend remains authoritative for active-session and concurrency rules.

## Department Head DTR

`GET /api/reports/dtr` derives the department scope from the authenticated Department Head. The department DTR frontend submits only `from`, `to`, `student_id`, and `assignment_id`; it never submits a department or actor override. Report totals and integer worked/credited minutes are authoritative.

The Department Students roster is derived exclusively from this scoped DTR response. It represents students served through attendance in the authenticated department; it does not expose the global student directory or infer a permanent department assignment that the student schema does not contain.

Department Head reads from `GET /api/community-service` and `GET /api/community-service/:id` are restricted to assignments routed to the authenticated department or already having attendance sessions there. Assignments outside that scope are not visible (404 for detail). Assignment creation, editing, and deletion remain unavailable to Department Heads.

Department Head non-compliance reports accept only the `sort_by` values `date`, `hours`, or `violations`. They include only students who have service attendance in the authenticated department; client-selected department filters are rejected.

Department operational CSV exports are generated only from the currently loaded, backend-scoped DTR or non-compliance response. They intentionally exclude guardian details and global directory fields, consistent with Department Head RBAC.

## Parent and guardian contact

`GET /api/parent-contact/{studentId}` and `POST /api/parent-contact/{studentId}` require Admin, Discipline Office, or Department Head access. Admin and Discipline Office may review enrolled students. Department Heads can access only students with recorded community-service attendance in their authenticated department; out-of-scope students receive the same 404 response as missing students. Clients cannot select an actor or department.

Contact recording is append-only and accepts only a guardian ID belonging to the scoped student, a controlled method and outcome, and optional bounded notes. Each attempt records the authenticated staff member, derived department where applicable, timestamp, and audit event. There are no update or delete endpoints. Department reports and exports continue to omit guardian information.

## Student clearance self-service

`GET /api/student/clearance` and `/api/student/clearance/eligibility` accept no query parameters and derive ownership from the authenticated student account. The records response omits the internal `cleared_by` user ID while retaining status, blocker flags, approval timestamp, academic period, and remarks. Eligibility is live and may differ from older historical records.

## Student notifications

`GET /api/students/me/notifications` derives ownership exclusively from the authenticated user ID. It accepts only `page` and `limit`, returns newest notifications first, and never accepts a student or user ownership override. This milestone is read-only; notification read-state mutation is deferred.

## Google student authentication

`POST /api/auth/google/link` accepts only the Google credential and the student's registration details: Student Number, name, personal phone, program, section, year level, guardian name, guardian relationship, and guardian phone. Existing active students are linked after an exact normalized full-name and Student Number match; the comparison tolerates different first/last field splits for multi-word names without accepting missing or different name tokens. A new unique identity creates a `PENDING` enrollment request and returns HTTP 202 without a user, QR, link, JWT, or portal access. Existing mismatches and conflicts remain generic.

`GET /api/google-registrations` and the `/:id/approve` and `/:id/reject` actions require `ADMIN` or `DISCIPLINE_OFFICE`. Review actions require a reason and derive the reviewer from authentication. Approval atomically creates the student account, verified profile, primary guardian contact, opaque QR, Google link, and audit events; rejection preserves history. The student's own profile may return the primary guardian phone, but other student self-service data remains ownership-scoped and Department operational reports omit guardian details. Review responses never expose the stable Google subject. `POST /api/auth/google/login` accepts only `credential` and succeeds only after linking or approval.

## Google department officer authentication

`POST /api/auth/google/department/register` accepts only a Google `credential`, officer first/last name, optional employee number, controlled `department_type`, requested `department_name`, and optional note. The controlled types are `LIBRARY`, `SCHOOL_GUARD`, `STAFF_OFFICE`, and `OTHER`. A successful submission returns HTTP 202 with a pending reference and never creates a user, department mapping, Google link, or JWT.

`POST /api/auth/google/department/login` accepts only `credential`. It succeeds only for a Google identity linked to an active `DEPARTMENT_HEAD` user whose mapped department is active. The authenticated middleware reloads department scope from the database; the client cannot supply or override that scope.

`GET /api/admin/google-department-registrations` and its `/:id/approve` and `/:id/reject` actions require `ADMIN`; `DISCIPLINE_OFFICE` is explicitly excluded. Approval requires a reason and an existing active `department_id`, then atomically creates one individual Department Head user, one department mapping, one Google link, and audit events. The generated fallback password is random and never disclosed. Rejection preserves the request. Review responses omit the stable Google subject and all credentials.

Student and department registration transactions serialize ownership checks by Google subject and reject active links or pending cross-role claims. Individual employee numbers also cannot be reused by an active officer or simultaneous pending request.

## Session invalidation and required password change

Application JWTs contain the account's current `session_version` and password-change-required state. Authentication reloads both values from the active database account. A missing or stale session version returns `SESSION_INVALIDATED`; role changes, status changes, and password resets can therefore invalidate previously issued sessions immediately.

Accounts marked `must_change_password` receive a restricted session. Role-protected endpoints return `PASSWORD_CHANGE_REQUIRED`; only `POST /api/account/password-change` remains available. That endpoint accepts only `current_password` and `new_password`, verifies the existing credential, rejects reuse, enforces the password policy, increments the session version, audits the action without credential material, and returns a normal replacement session. The frontend never persists either password.

Revoked Google identity links remain historical records. Active-link uniqueness applies only where `revoked_at IS NULL`, allowing the later audited recovery workflow to revoke rather than delete link history.

`POST /api/admin/students/:studentId/google-link/revoke` is restricted to `ADMIN`, accepts only a required `reason`, revokes the active link without deleting identity history, increments the student account's session version, and records `GOOGLE_LINK_REVOKE`. Missing and already-revoked links use the same non-sensitive conflict response. The endpoint never returns the Google subject, email snapshot, credential, or token; the student must complete the normal linking flow again.

`GET /api/admin/duplicate-review` is an `ADMIN`-only, read-only comparison of current records and pending requests. It reports cross-source student-number, employee-number, prospective-username, and Google-identity conflict groups. It cannot resolve, merge, reject, or delete records. Google matching keys and email snapshots remain server-private; Google groups return only `Hidden Google identity`, source categories, local record IDs, and occurrence counts.

## Staff account administration

`/api/admin/accounts` requires an active `ADMIN` session. Listing supports bounded pagination plus role, active-status, and search filters and returns only non-sensitive staff summaries. Creation accepts an individual username, non-Student staff role, officer name, optional employee number/email, and an active `department_id` only for `DEPARTMENT_HEAD`. It returns a cryptographically generated temporary password exactly once and marks the account for mandatory password change.

The `/:id/status`, `/:id/assignment`, and `/:id/password-reset` actions require reasons, lock target records, audit the actor, and increment `session_version`. Administrators cannot deactivate or reassign themselves, concurrent operations cannot remove the final active Admin, and an active Department Head must retain exactly one active department mapping. Generic staff creation and reassignment never accept the `STUDENT` role. Passwords, hashes, JWTs, and Google identity values are excluded from account lists and audit descriptions.

## Department administration

`GET` and `POST /api/admin/departments` plus `PATCH /api/admin/departments/:id` require `ADMIN`. The directory returns official code/name, description, status, and assigned/active account counts. Creation normalizes the unique department code and records an audit event. Updates require a reason and preserve the department record; there is no delete endpoint.

An active department cannot be deactivated while active Department Head accounts remain assigned. The check locks the department and runs in the same transaction as the update. Officers must first be reassigned or deactivated through account administration. The Google department-registration reviewer obtains approval choices from this canonical directory and displays only active departments.

## Filters and pagination

DTR reports whitelist `from`, `to`, `department_id`, `student_id`, and `assignment_id`; student DTR allows only `from` and `to`. Dates are UTC calendar dates in strict `YYYY-MM-DD` form. Department Heads are always scoped to their mapped department.

Large-list pagination uses `page` and `limit` where exposed. The contract default is 25 and maximum is 100. Unknown privileged body fields are rejected on stabilized create/update endpoints rather than silently applied.
