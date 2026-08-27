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

## Department Head QR attendance

Department Heads may submit only `qr_code` and optional `notes` to `/api/qr/scan`, `/api/qr/time-in`, and `/api/qr/time-out`. Their actor and department are derived from the authenticated account. Client-supplied `scanned_by` or `department_id` fields are rejected. The frontend requires a successful `/api/qr/scan` confirmation for the current code before enabling attendance actions; the backend remains authoritative for active-session and concurrency rules.

## Department Head DTR

`GET /api/reports/dtr` derives the department scope from the authenticated Department Head. The department DTR frontend submits only `from`, `to`, `student_id`, and `assignment_id`; it never submits a department or actor override. Report totals and integer worked/credited minutes are authoritative.

The Department Students roster is derived exclusively from this scoped DTR response. It represents students served through attendance in the authenticated department; it does not expose the global student directory or infer a permanent department assignment that the student schema does not contain.

Department Head reads from `GET /api/community-service` and `GET /api/community-service/:id` are restricted to assignments having attendance sessions in the authenticated department. Assignments outside that scope are not visible (404 for detail). Assignment creation, editing, and deletion remain unavailable to Department Heads.

Department Head non-compliance reports accept only the `sort_by` values `date`, `hours`, or `violations`. They include only students who have service attendance in the authenticated department; client-selected department filters are rejected.

Department operational CSV exports are generated only from the currently loaded, backend-scoped DTR or non-compliance response. They intentionally exclude guardian details and global directory fields, consistent with Department Head RBAC.

## Student clearance self-service

`GET /api/student/clearance` and `/api/student/clearance/eligibility` accept no query parameters and derive ownership from the authenticated student account. The records response omits the internal `cleared_by` user ID while retaining status, blocker flags, approval timestamp, academic period, and remarks. Eligibility is live and may differ from older historical records.

## Filters and pagination

DTR reports whitelist `from`, `to`, `department_id`, `student_id`, and `assignment_id`; student DTR allows only `from` and `to`. Dates are UTC calendar dates in strict `YYYY-MM-DD` form. Department Heads are always scoped to their mapped department.

Large-list pagination uses `page` and `limit` where exposed. The contract default is 25 and maximum is 100. Unknown privileged body fields are rejected on stabilized create/update endpoints rather than silently applied.
