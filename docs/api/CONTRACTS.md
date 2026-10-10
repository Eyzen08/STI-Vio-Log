# Backend API contracts

All protected endpoints use the opaque `sti_session` HttpOnly cookie. Browser requests include credentials automatically; mutating requests also require the session-bound `X-CSRF-Token` header. Bearer credentials are unsupported and stripped by the frontend transport. Successful responses retain the existing `success: true` envelope. Errors preserve `success: false` and `message` for compatibility and use the stable shape below where the endpoint has been migrated:

```json
{"success":false,"message":"Human-readable message","error":{"code":"VALIDATION_ERROR","message":"Human-readable message"}}
```

Standard statuses are 400 validation/business rules, 401 authentication, 403 authorization, 404 missing or non-visible resources, 409 concurrency/database conflicts, and 500 unexpected failures. Student self-service never accepts an ownership identifier; it derives ownership from the authenticated account. Private resources outside that ownership are treated as not visible (404) unless access is rejected at the role boundary (403).

## Terms acknowledgment and Privacy Notice

`GET /api/auth/legal` returns `{ success: true, legal }` for the authenticated account. `legal` contains `enforcement_enabled`, `required`, `acknowledgment_version`, `terms_version`, `privacy_notice_version`, `acknowledged_at` (nullable server timestamp), and the published `documents`. Enforcement is disabled in this technical release, so `required` is false and no acknowledgment is needed for ordinary access.

`POST /api/auth/legal/acknowledge` requires the session cookie and CSRF header. Its body contains only `acknowledgment_version`, `terms_version`, and `privacy_notice_version`, matching the displayed status. The account, content hashes and timestamp are server-derived. Unknown fields are rejected (400); disabled enforcement returns 409 `LEGAL_ACKNOWLEDGMENT_DISABLED`; stale versions return 409 `LEGAL_POLICY_CHANGED`, requiring a status refresh. Successful writes return the same status envelope. Duplicate submissions for an account/acknowledgment version are idempotent and retain the original timestamp.

When approved enforcement is enabled, protected APIs return 403 `TERMS_ACKNOWLEDGMENT_REQUIRED` until the server finds the required version. Session restoration, CSRF refresh, forced password change, legal endpoints and logout remain available. Password-change requirements take precedence. Realtime handshakes and existing socket authorization also check acknowledgment. The frontend delays protected requests until status resolves. The recorded Privacy Notice version identifies the notice offered, not consent or proof of reading. Only an approved material Terms update increments the required acknowledgment version.

## Authenticated real-time refresh events

Socket.IO connects with the same opaque cookie session and `withCredentials: true`; no token is placed in the handshake payload. The server revalidates the active account, session version, forced-password-change state, role, and Department Account assignment before joining private rooms.

- `messages:changed` is sent only to the affected student account and authorized Discipline Administrator/Discipline Office role rooms. Historical department assignments remain stored but do not grant Department Accounts realtime or API access.
- `community-service:changed` is sent only to the assigned department, affected student, and Admin/Discipline Office role rooms.
- Event payloads contain refresh identifiers only. Clients retrieve authoritative records through the existing REST endpoints.
- Existing periodic REST polling remains enabled as a reconnect and service-degradation fallback.

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

`POST /api/students` requires an exactly 11-digit `student_number`, `first_name`, `last_name`, and personal Gmail `email`, with optional `middle_name` and `suffix`. Phone, academic fields, QR values, profile images, ownership fields, and other properties are rejected. The backend generates the QR value and random temporary password, creates the account/profile atomically, and marks the new account for mandatory onboarding. The password expires after 24 hours, is returned once, and is never logged. `POST /api/students/:id/credentials-email` explicitly sends the current valid temporary password, Student Number, and login link to the recorded Gmail; expired or replaced credentials cannot be sent.

The Add Student drawer reviews the normalized identity/Gmail values before submitting that exact snapshot. `PATCH /api/students/:id/credentials-email` permits only Admin and Discipline Office users and accepts only `email`, a non-empty `reason` (up to 1,000 characters), and the currently displayed `temporary_password` (up to 72 UTF-8 bytes). A transaction locks the account, checks that it remains active and in mandatory onboarding before password change, rejects active Google links or stale credentials, and enforces personal-Gmail uniqueness. It saves the address, rotates the password with a fresh 24-hour expiry, clears pending Google verification, revokes browser sessions/OTPs/reset authorizations, and records the reason without credential secrets. A successful `Cache-Control: no-store` response contains `student`, `account.username`, and the replacement `temporary_password`. Saving does not send mail; the separate POST uses the saved recipient. Concurrent or stale corrections return 409. No migration is required.

`PUT /api/students/:id` allows Admin and Discipline Office users to correct student information with a required audit reason. Changing the Student Number updates the linked local username in the same transaction, invalidates existing sessions, and preserves all disciplinary, DTR, service, message, and clearance relationships. `POST /api/students/:id/password-reset` issues a cryptographically generated temporary password exactly once with a 24-hour expiry, activates local access, invalidates existing sessions/reset authorizations and the old password, and requires a password change at first sign-in. Local credentials and an active Google link are independent login choices for the same student record.

## Department Head QR attendance

Department Heads may submit only a bounded opaque `qr_code` and optional bounded `notes` to `/api/qr/scan`, `/api/qr/time-in`, and `/api/qr/time-out`. Their actor and department are derived from the authenticated account, and every request rechecks the current department assignment, active department state, and `qr_scanner_enabled` permission. Client-supplied `scanned_by` or `department_id` fields are rejected. QR attendance requires an active assignment explicitly assigned to that department; legacy unassigned work cannot be claimed through scanning. The frontend requires a successful `/api/qr/scan` confirmation for the current code before enabling attendance actions; the backend remains authoritative for active-session and concurrency rules.

QR verification returns only the active linked student's operational identity, academic display fields, assigned department, authoritative progress totals, current active-session state, and latest attendance activity. Inactive accounts, unknown or expired opaque codes, closed violations, and students without an active department-matching assignment are rejected. Admin and Discipline Office users must select an active configured department; Department Heads remain locked to their authenticated department. Time-out additionally requires `attendance_outcome` (`TODAYS_SERVICE_COMPLETED`, `LEFT_EARLY`, or `SERVICE_COMPLETED`), and all credited duration is calculated transactionally from server timestamps.

## Department Head DTR

`GET /api/reports/dtr` derives the department scope from the authenticated Department Head. The department DTR frontend submits only `from`, `to`, `student_id`, and `assignment_id`; it never submits a department or actor override. Report totals and integer worked/credited minutes are authoritative.

The Department Students roster is derived exclusively from this scoped DTR response. It represents students served through attendance in the authenticated department; it does not expose the global student directory or infer a permanent department assignment that the student schema does not contain.

Department Head reads from `GET /api/community-service` and `GET /api/community-service/:id` are restricted to assignments routed to the authenticated department or already having attendance sessions there. Assignments outside that scope are not visible (404 for detail). Assignment creation, editing, and deletion remain unavailable to Department Heads.

Department Head non-compliance reports accept only the `sort_by` values `date`, `hours`, or `violations`. They include only students who have service attendance in the authenticated department; client-selected department filters are rejected.

Department operational CSV exports are generated only from the currently loaded, backend-scoped DTR or non-compliance response. They intentionally exclude guardian details and global directory fields, consistent with Department Head RBAC.

Administrative reports include violations, community service, DTR, non-compliance, parent-contact activity, clearance, and current good-standing students. Parent-contact exports identify the guardian and operational outcome but omit guardian phone numbers. Good standing is calculated live: students with no historical violations are `GOOD_STANDING`, while students with resolved history and no active violation or pending service are `CLEARED`. CSV generation quotes every cell and prefixes spreadsheet formula characters to prevent formula injection.

## Secure messaging

`/api/messages/conversations` provides paginated, searchable, text-only, append-only conversation summaries; message history is loaded separately and paginated. `/api/messages/unread-count` returns only `{ success, unread_total }` for lightweight badge polling. Students can access only conversations attached to their authenticated student record. A student creates a conversation with only `subject` and `message`; `recipient_department_id` and every other ownership or recipient override are rejected. The only student recipient is authorized Discipline Office personnel. Discipline Administrators and Discipline Office users may communicate with individual students and change a conversation between `OPEN` and `CLOSED`. Department Accounts receive 403 from every messaging endpoint. Historical `assigned_department_id` values remain stored solely for audit history and grant no access. Conversation detail, reply, read-state, and status endpoints repeat authorization checks, and inaccessible conversation IDs return 404. Messages are bounded to 1,000 characters and have no update or delete endpoint.

## Parent and guardian contact

`GET /api/parent-contact/{studentId}` and `POST /api/parent-contact/{studentId}` require Admin, Discipline Office, or Department Head access. Admin and Discipline Office may review enrolled students. Department Heads can access only students with recorded community-service attendance in their authenticated department; out-of-scope students receive the same 404 response as missing students. Clients cannot select an actor or department.

Contact recording is append-only and accepts only a guardian ID belonging to the scoped student, a controlled method and outcome, and optional bounded notes. Each attempt records the authenticated staff member, derived department where applicable, timestamp, and audit event. There are no update or delete endpoints. Department reports and exports continue to omit guardian information.

## Student clearance self-service

`GET /api/student/clearance` and `/api/student/clearance/eligibility` accept no query parameters and derive ownership from the authenticated student account. The records response omits the internal `cleared_by` user ID while retaining status, blocker flags, approval timestamp, academic period, and remarks. Eligibility is live and may differ from older historical records.

`GET /api/student/clearance/certificate` returns a certificate only when the authenticated student has an approved `CLEARED` record and remains currently eligible. The server signs the certificate reference; the browser cannot select a student, clearance record, status, or approval date. `GET /api/certificates/clearance/{code}` publicly verifies only a correctly signed certificate that is still backed by a live approved clearance. A newly opened violation or pending service requirement makes prior certificate verification fail automatically.

## Student notifications

`GET /api/students/me/notifications` derives ownership exclusively from the authenticated user ID. It accepts only `page` and `limit`, returns newest notifications first, and never accepts a student or user ownership override. `PATCH /api/students/me/notifications/{id}/read` accepts an empty body and can update only a notification owned by that authenticated student; out-of-scope IDs are treated as not found.

Violation creation, service assignment, DTR time-in, DTR time-out, and service completion create transactional student notifications. Each event uses a server-generated idempotency key, so retrying the surrounding operation cannot create a duplicate notification. A notification is committed or rolled back with its underlying domain event, and marking it read never changes the violation, assignment, DTR, or clearance record.

## Google student authentication

`POST /api/auth/google/link` is removed and returns 404. Public password registration and Google registration are retired. Unknown Google identities must use staff-issued local credentials, change their temporary password, and complete authenticated verification/binding. Retained historical registrations remain reviewable with an auditable reason.

`GET /api/google-registrations` and the `/:id/approve` and `/:id/reject` actions require `DISCIPLINE_ADMIN` or `DISCIPLINE_OFFICE`. Both decisions require a bounded Discipline Office review note, and the reviewer is always derived from authentication. Approval atomically creates the student account, student profile, primary guardian contact, opaque QR, Google link, and audit events; rejection preserves history. No Registrar, enrollment, or academic-period evidence is collected by this workflow. The student's own profile may return the primary guardian phone, but other student self-service data remains ownership-scoped and Department operational reports omit guardian details. Review responses never expose the stable Google subject. `POST /api/auth/google/login` accepts only `credential` and succeeds only after linking or approval.

## Google department officer authentication

Department Google signup and login are retired. Historical requests and identity links remain stored for audit history but have no active public or administrative HTTP route.

`/api/department-accounts` requires Admin or Discipline Office authentication and manages only the internal `DEPARTMENT_HEAD` role, presented to users as a **Department Account**. Creation accepts a username and active department, generates a temporary password exactly once, and forces a password change on first sign-in. Credentials are delivered privately by the Discipline Office. The narrow endpoint cannot create, reassign, reset, activate, or deactivate Admin, Discipline Office, or Student accounts.

Department Accounts have operational access only to their assigned department's QR verification/time-in/time-out and assigned service records. They cannot access messaging, parent/guardian contact, clearance approval, global student records, non-compliance reports, or administrative reports.

Every assignment lookup and direct attendance mutation rechecks the authenticated Department Account's current active department against the assignment destination. A client-supplied assignment or student ID cannot bypass this boundary, and cross-department records use a non-visible response. Department Account creation is serialized per department so concurrent requests cannot both pass the one-active-account check.

Every time-out records authoritative worked minutes, a controlled attendance outcome, and an optional result note. `SERVICE_COMPLETED` is accepted only when credited time fulfills the remaining requirement; `TODAYS_SERVICE_COMPLETED` and `LEFT_EARLY` are accepted only while required time remains. Left-early sessions still receive eligible elapsed-time credit. The assigned Department Account's time-out immediately applies credit capped at the remaining required minutes, updates assignment and violation progress, and records the actor in immutable attendance, progress, and audit history. Historical service-condition values retain their original labels. Discipline Office approval is not required for new attendance. Legacy pending results created by older releases remain reviewable by Admin or Discipline Office through the existing review endpoints.

`GET /api/community-service/active-sessions` is available only to an authenticated, currently authorized Department Account. It returns active sessions assigned to that same department for live elapsed-time monitoring; it accepts no department override.

## Session invalidation and required password change

Opaque browser sessions are stored server-side as hashes and carry the account's current `session_version` and password-change-required state. Authentication reloads both values from the active database account. A missing or stale session version returns `SESSION_INVALIDATED`; role changes, status changes, and password resets invalidate existing sessions immediately. Protected API 401 responses clear the local user hint, disconnect realtime, and return the browser to `/login`; login, registration, Google, and MFA failures remain in their own forms.

Accounts marked `must_change_password` receive a restricted session. Role-protected endpoints return `PASSWORD_CHANGE_REQUIRED`; only `POST /api/account/password-change` remains available. That endpoint accepts only `current_password` and `new_password`, verifies the existing credential, rejects reuse, enforces the password policy, increments the session version, audits the action without credential material, and returns a normal replacement session. The frontend never persists either password.

New Student accounts provisioned by the Discipline Office also return `onboarding_required` and `onboarding_step`. During the Google step, `google_onboarding_stage` is `EMAIL`, `OTP`, or `OAUTH`, and `onboarding_google_email` contains the authenticated student's staff-recorded Gmail, which students cannot edit. `POST /api/account/student-onboarding/google-email/request` accepts only `email`; `POST /api/account/student-onboarding/google-email/verify` accepts only `code`. Codes use the shared ten-minute, five-attempt, sixty-second-resend policy and are bound to the destination address. `POST /api/account/student-onboarding/google-link` accepts only `credential` and requires Google's verified email to match both the staff-recorded Gmail and OTP-confirmed address. Active identity uniqueness uses Google's verified `sub`, with one active identity per account and one account per identity. Failed OTP attempts remain committed independently of the failed verification transaction. The profile request accepts `academic_level`, `strand`, `program`, `section`, `year_level`, and the existing contact/guardian fields. College requires program and year 1-4; SHS requires ABM or STEM and Grade 11 or 12. Both require section. Existing completed and already-linked Student accounts are unaffected.

Revoked Google identity links remain historical records. Active-link uniqueness applies only where `revoked_at IS NULL`, allowing the later audited recovery workflow to revoke rather than delete link history.

`POST /api/admin/students/:studentId/google-link/revoke` is restricted to `DISCIPLINE_ADMIN` and `DISCIPLINE_OFFICE`, accepts a required `reason` and optional replacement personal Gmail `email` (defaulting to the recorded address), rejects another student’s Gmail, revokes the active link and browser sessions, invalidates OTPs/reset authorizations, increments the session version, and records `GOOGLE_LINK_REVOKE`. It sets `google_rebind_required` without changing academic or disciplinary history. The student must verify the recorded Gmail and bind it before returning to the portal, including recovered legacy accounts. Missing/already-revoked links use the same non-sensitive conflict response. No Google subject, credential, or token is returned.

`GET /api/admin/duplicate-review` is a `DISCIPLINE_ADMIN`-only, read-only comparison of active accounts and linked profiles. It reports duplicate student-number, employee-number, username, and active Google-identity groups. Pending registration requests are excluded. It cannot resolve, merge, reject, or delete records. Google matching keys remain server-private; Google groups return only `Hidden Google identity`, source categories, local record IDs, and occurrence counts. The separate `rejected_attempts` array includes the latest 50 denied Student Number, Gmail, and Google identity conflicts from security audit records, with time, conflict type, target label, actor summary, and reason. Secret audit details are not returned.

## Staff account administration

`/api/admin/accounts` requires an active `DISCIPLINE_ADMIN` session. Listing supports bounded pagination plus role, active-status, and search filters and returns only non-sensitive staff summaries. Creation accepts an individual username, non-Student staff role, officer name, optional employee number/email, and an active `department_id` only for `DEPARTMENT_HEAD`. It returns a cryptographically generated temporary password exactly once and marks the account for mandatory password change.

The `/:id/status`, `/:id/assignment`, and `/:id/password-reset` actions require reasons, lock target records, audit the actor, and increment `session_version`. Administrators cannot deactivate or reassign themselves, concurrent operations cannot remove the final active Discipline Administrator, and an active Department Head must retain exactly one active department mapping. Generic staff creation and reassignment never accept the `STUDENT` role. Passwords, hashes, session values, CSRF tokens, and Google identity values are excluded from account lists and audit descriptions.

## Department administration

`GET` and `POST /api/admin/departments` plus `PATCH /api/admin/departments/:id` require `DISCIPLINE_ADMIN`. The directory returns official code/name, description, status, and assigned/active account counts. Creation normalizes the unique department code and records an audit event. Updates require a reason and preserve the department record; there is no delete endpoint.

An active department cannot be deactivated while active Department Head accounts remain assigned. The check locks the department and runs in the same transaction as the update. Officers must first be reassigned or deactivated through account administration. The Google department-registration reviewer obtains approval choices from this canonical directory and displays only active departments.

## Filters and pagination

DTR reports whitelist `from`, `to`, `department_id`, `student_id`, and `assignment_id`; student DTR allows only `from` and `to`. Dates are UTC calendar dates in strict `YYYY-MM-DD` form. Department Heads are always scoped to their mapped department.

Large-list pagination uses `page` and `limit` where exposed. The contract default is 25 and maximum is 100. Unknown privileged body fields are rejected on stabilized create/update endpoints rather than silently applied.
# System operations and high-risk actions

- `GET /api/system/status` returns sanitized component states, database latency, remediation text, deployment metadata, and recent failed/denied event summaries.
- `GET /api/system/accounts?search=&limit=` returns only account targeting fields needed by Discipline Administrators.
- `GET /api/system/security-events` accepts `search`, `result`, `from`, `to`, `page`, and `limit`.
- `POST /api/high-risk-actions/step-up` verifies the current Discipline Administrator password and returns a five-minute, single-use token bound to the action, target, and current target version.
- `POST /api/high-risk-actions/execute` accepts the registered action, target, reason, and step-up token. It rejects arbitrary actions, replayed tokens, self-targeting, and changed targets.
- `GET /api/high-risk-actions` returns retained historical and directly executed high-risk-action records.
- Temporary support-access and approval-oriented high-risk endpoints are retired; their database records remain available for audit history.


## College and Senior High School support

The system supports College programs (years 1-4 for new academic submissions) and Senior High School **ABM** (Accountancy, Business, and Management) and **STEM** (Science, Technology, Engineering, and Mathematics), Grades 11-12. SHS requires a strand and section instead of a College program. Both modes retain the same Student role and authorization rules. See the [student academic model](../STUDENT-ACADEMIC-MODEL.md) for account setup, audited corrections, API fields, historical records, migration 043, and acceptance examples.
