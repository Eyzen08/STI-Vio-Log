# Community service attendance implementation

> **October 10, 2026 audit addendum.** The execution/browser results below are historical release evidence, not checks repeated in this audit. Migration 046 and later files through 050 were observed applied on the matched database; both hosting providers showed the audited commit. Current results: 334 backend, 438 frontend unit tests passed; the all-database run passed 48/49 with an unrelated stale academic migration assertion. Production health/CORS boundaries passed; authenticated attendance and physical cameras remain unverified here. See [testing](TESTING.md).


Approved plan: scan, automatic verification, duration selection, server-authoritative Time In/Out, shared timers and auditable credit.

- Decisions: assignment department; final remainder allowed; Asia/Manila midnight stops credit until staff closes the session.
- Execution: implementation reviewed on `codex/community-service-attendance`; the user approved publishing it to `origin/main`.
- Tasks: timing/schema; permissions/APIs; scanner/shared timers/history; verification and final review.
- Verification: backend unit/API tests 279/279; frontend tests 365/365; dedicated PostgreSQL attendance, workflow and migration tests 30/30. Frontend lint and production build pass. Network and Vite/React rendering checks pass in the permitted environment; no Vite workaround or dependency changes were needed.
- Database: an isolated, temporary PostgreSQL 18 cluster was used because TEST_DATABASE_URL was initially absent. Runtime data was never used. Every integration suite creates and drops its own guarded schema.
- Browser: synthetic scanner fixtures checked at 1440, 768 and 390 pixels. Confirm Time In, fixed/Open Time timers, disabled choices, cancellation, early Time Out confirmation, modal focus, two-column mobile duration grid and absence of horizontal page scrolling were checked. Physical camera capture was not exercised; existing QR camera code and library remain in place.
- Shared timing responses cover QR verification, active attendance, student DTR and session history. Old fields remain compatibility aliases. Live timers use server time plus monotonic elapsed time; displayed projections are separate from saved totals.

## Review rulings

- Final duration snapshots normalize to the server's exact available remainder; timestamp cutoffs round up to the next millisecond so six-decimal hour balances can finish. Normal credit still uses whole minutes and exact fractional final credit stays capped.
- Recorders, department scope, scanner permissions and eligible supervisors are checked again inside the transaction after the student lock. Officer assignment boundaries use the live database clock rather than transaction-start time.
- Manual corrections take the same student-first lock order, preserve six-decimal balances and remain separate from dated attendance credit.
- Active sessions must be timed out before clearing/cancelling a violation or approving legacy credit on that same assignment. This prevents closed assignments from stranding student-wide active sessions. Credit approvals on other assignments share the daily allowance.
- Quiet refresh discards obsolete ACTIVE receipts; rescanning prioritizes the current active assignment and recovers from an old assignment picker value. Admin monitoring receives the save callback and shared Time Out modal supports authorized supervisor transfers.
- Fresh read-only review findings were fixed and regression-tested. Production-data upgrades and physical camera behavior remain deployment checks; they were not inferred from synthetic fixtures.

## Coordinated release

1. Back up the database and pause attendance writes during the release. With the privileged migration connection, run `npm run migrate` from backend to apply `046_service_session_duration.sql` through the existing runner.
2. If the migration reports duplicate active student sessions, stop the release. Investigate the listed session IDs and resolve them explicitly; the migration rolls back without closing or crediting any session. Retry after resolution.
3. Release this backend and frontend together, then reopen attendance. The new backend requires explicit service mode/duration and session IDs; do not run the old frontend against it.
4. Smoke-check QR verification, Time In, active refresh, preview and saved Time Out using an authorized test account. Confirm historical DTR records and existing database access restrictions/RLS remain unchanged.

The user approved Git integration into `origin/main`. Production migration and deployment remain separate coordinated release steps.

Repeat checks with a dedicated TEST_DATABASE_URL:

```text
backend: npm test
backend: node --test tests/service-attendance.pgtest.js tests/violation-workflow.pgtest.js tests/migrations.pgtest.js
frontend: npm test
frontend: npm run lint
frontend: npm run build
```

## Invalidate an assignment's service day

Authorized attendance staff (Discipline Admin, Discipline Office and department heads with current department/scanner access) can invalidate a recorded Manila service date on an open or in-progress assignment with an open violation. Use Invalidate Day beside attendance controls or select a recorded date in the assignment drawer. Preview lists affected sessions, removed credit and the resulting balance. A visible reason of 1–500 characters is required; staff determine whether the student failed to return or meet expectations. No automatic minimum-hours rule is applied.

Confirmation cancels every session's credit for that assignment/date and closes any active session, pause and officer interval administratively. It does not create a QR scan or claim the student returned. Other assignments and dates are unchanged. Original credit, pauses and progress history remain available. Canceled elapsed time still consumes the student-wide eight-hour daily allowance; new credit for that assignment is blocked on the invalidated date, including legacy approval. Students see the reason, staff identity and timestamp in their attendance history and receive a notification. DTR reports and their Invalidated Days Excel sheet retain the cancellation details separately from office corrections.

The API provides GET `/api/community-service/:assignmentId/days/:serviceDate/invalidation-preview` and POST `/api/community-service/:assignmentId/days/:serviceDate/invalidate` with `{ reason, preview_version }`. Dates are YYYY-MM-DD in Asia/Manila. Stale previews return 409 `STALE_DAY_PREVIEW` and must be reviewed again. A retry using the same preview cannot deduct twice. A negative balance caused by earlier office corrections returns 409 `CREDIT_RECONCILIATION_REQUIRED`; the office must reconcile the total first.

There is no restore-day action. Existing office corrections can repair totals with a reason, while the date remains blocked. Completed assignments and clearance/certificate reopening are excluded. Deploy migration `052_service_day_invalidations.sql` before the matching backend/frontend, with attendance writes paused during the coordinated release. This migration adds an append-only day record and per-session credit/allowance snapshots; it does not invalidate existing records.

Browser regression: `node frontend/scripts/check-service-day-invalidation.mjs` with Playwright available locally or through NODE_PATH (no application dependency added). The API and persistence regressions are in `backend/tests/service-attendance.pgtest.js` and run only against an explicitly disposable test database.
