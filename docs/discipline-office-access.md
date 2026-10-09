# Discipline Office access

`DISCIPLINE_ADMIN` and `DISCIPLINE_OFFICE` share operational permissions across departments, including violation closure/reopening, audited hour corrections, attendance, service, clearance, messages, and reporting. Administration remains Admin-only, including its legacy registration review API. Department Head accounts retain their department and scanner restrictions.

Attendance events are delivered to every active office account. Each recipient has a separate notification and read state; private account/security and message notifications remain account-specific.

Violation updates omit an unchanged incident date, preventing an hour-only correction from rewriting a locally serialized date. Existing local date display normalization is outside this access change.

## Release

Deploy the updated backend notification recipient rules before running migration `049_office_attendance_notifications.sql` with the existing migration runner. Deploy the frontend with the same release. Migration 049 only inserts missing attendance copies; it does not change permissions, schemas, existing read states, or school records.

The backfill covers identifiable staff attendance events with the existing recipient-specific `attendance:` event keys. It preserves original timestamps and record links, and initializes new copies as unread. Legacy alerts without structured keys are left untouched because they cannot be reliably deduplicated. Repeating the SQL is safe.

## Verification

Run `npm test` in both projects and frontend `npm run lint` / `npm run build`. Set `TEST_DATABASE_URL` to a dedicated database and run backend `npm run test:migrations`, `npm run test:attendance-integration`, and `npm run test:violation-integration`. The database suites create and remove guarded test schemas. Check both office roles in the browser, including Administration denial and independent notification read states.
