# Admin violation corrections

The violation editor supports classification, handbook offense, incident details,
incident date/time, required hours, and completed-hour corrections. A reason is
required. Closed cases must be reopened before editing. Cancellation retains the
case and attendance evidence while removing active obligations and offense counts.

Completed-hour corrections require `DISCIPLINE_ADMIN`. Hours are decimal hours
with up to two decimal places; completed hours cannot exceed required hours.
Changing hours or cancelling a case is blocked until active attendance times out.
When service is assigned inside the editor, an active department and its active
Department Head are required. Existing assignment routing is preserved.

Attendance records remain unchanged. Corrections are stored in the append-only
`community_service_hour_corrections` table and shown separately in case history,
student service views, and DTR reports. Future attendance credits add to the
corrected completed-hour total.

`PUT /api/violations/:id` accepts the fields described in the OpenAPI contract.
`PUT /api/community-service/:id` continues to accept `required_hours` and now also
requires `reason`; it uses the same correction transaction and validation.

## Release order

1. Apply `045_service_hour_corrections.sql` through `npm run migrate` from `backend`
   using the deployment's migration database credentials.
2. Deploy the backend, then deploy the frontend. Old description-only edits with
   a reason remain supported for open cases.
3. Verify an admin can correct a test case, that service totals refresh, and that
   its correction appears in case history and DTR. Confirm cancellation and
   reopening retain attendance. Use nonproduction records for these checks.

The migration is additive and does not rewrite historical attendance or hours.
