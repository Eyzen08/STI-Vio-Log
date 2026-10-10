# Final Acceptance Checklist

> **Acceptance remains pending.** Reviewed October 10, 2026; boxes below are manual acceptance tasks and were not marked passed by this audit. [Testing](TESTING.md) records actual automated/read-only checks. Sections concerning historical registrations apply only to isolated legacy fixtures; new accounts use staff issuance. Provider backup/restore, OAuth, mail delivery and physical camera results remain unavailable.


Run this checklist on a dedicated test student and test violation. Do not use a real disciplinary record. Record the date, tester, device, and pass/fail result for every section.

## 1. Prepare controlled test identities

- [ ] Create two distinct Discipline Office accounts and one Admin account. Each person receives only their own temporary password and changes it at first sign-in.
- [ ] Create Department Account A and Department Account B for two different active departments.
- [ ] Prepare unlinked Google test accounts and issued Student Number/password accounts for College, ABM Grade 11, and STEM Grade 12.
- [ ] Confirm every test account can log out and that a revoked or deactivated account cannot reuse an old session.

Never place passwords, Google credentials, session cookies, or CSRF tokens in screenshots or test notes.

## 2. Student registration and authentication

- [ ] Confirm public new-record Google self-registration is unavailable; prepare a historical pending request only in the isolated test database to test retained review.
- [ ] Confirm the student cannot enter the portal while the request is pending.
- [ ] Approve the request with a review note and confirm Google login now opens the same approved student record.
- [ ] Try the same Google account and Student Number again; confirm no duplicate account or profile is created.
- [ ] Sign in with the issued Student Number/password account, change the temporary password, reload, and confirm the session is restored.
- [ ] Log out and confirm protected pages no longer open.

## 3. Violation and community-service workflow

- [ ] Discipline Office creates a violation using a handbook category, exact offense, incident date, and incident description.
- [ ] Confirm the violation itself does not assign service hours.
- [ ] Discipline Office creates a community-service assignment, decides its required hours, and assigns Department A.
- [ ] Confirm Department A can see the assignment while Department B cannot see, scan, update, or export it.
- [ ] Confirm the student sees the violation and assigned community-service requirement.

## 4. Mobile QR and Digital DTR

Use the deployed HTTPS site on at least one Android phone and one iPhone if both are available.

- [ ] Student opens **My QR**; the QR renders and contains only the backend-issued opaque value.
- [ ] Department A grants camera permission and scans the student's QR.
- [ ] Time-In succeeds once; a repeated Time-In is rejected and does not create a duplicate active session.
- [ ] Department B tries the same QR and assignment; the action is rejected without revealing private assignment details.
- [ ] Department A opens Service Results and confirms the active student and live elapsed timer are visible.
- [ ] With Service Results open on a second device, record Time-In/Time-Out and confirm the list refreshes immediately; briefly disable networking and confirm polling recovers after reconnection.
- [ ] Department A confirms Time-Out from the live monitor or scanner; verify the server-derived outcome and optional note.
- [ ] Confirm worked minutes are non-negative, derived from server timestamps, and immediately credited up to the remaining requirement without Discipline Office approval.
- [ ] Test camera denial and manual QR entry; both must show usable instructions without a blank screen.

## 5. Supporting workflows

- [ ] Student and Discipline Office can open the same conversation, exchange replies, and clear unread badges by reading it.
- [ ] Keep the conversation open on both devices and confirm new replies and unread badges update without manually refreshing the page.
- [ ] Department Accounts cannot open student messaging or guardian contact information.
- [ ] Discipline Office records a manual parent/guardian contact attempt and it appears in the append-only log.
- [ ] Notifications appear for the intended student and do not expose another student's information.
- [ ] Clearance and good-standing results match unresolved violations and remaining approved service hours.
- [ ] Reports and CSV exports use the selected filters, contain the expected records, and do not expose passwords, tokens, guardian data, or raw internal IDs unnecessarily.
- [ ] Audit history identifies the individual Admin or Discipline Office account responsible for each tested action.

## 6. Security and recovery

- [ ] Verify administrator-only system lock/recovery boundaries. Separately review `DELETE /api/students/:id`: both operational staff roles can invoke this physical-delete route; approve retention/error behavior before exposing it in handover.
- [ ] Revoke a student's Google link; confirm the old Google identity can no longer log in and the preserved student record is not deleted.
- [ ] Reset a student or Department Account password; confirm the prior password/session fails and a forced password change is required.
- [ ] Change a staff role or department; confirm old permissions disappear immediately.
- [ ] Confirm expired, malformed, and tampered sessions return an authorization error without sensitive details.
- [ ] Confirm an unapproved web origin receives no CORS permission.

## 7. Production operations

- [ ] Render and Vercel show the intended commit and healthy deployment.
- [ ] Production Google OAuth lists the exact Vercel origin under authorized JavaScript origins.
- [ ] Managed PostgreSQL backups and retention are enabled; perform a restore rehearsal into a separate test database.
- [ ] Monitoring covers backend availability, database errors, failed deployments, and unusual authentication failures.
- [ ] Run the read-only smoke test from `backend`:

```powershell
$env:PRODUCTION_FRONTEND_URL = "https://sti-vio-log.vercel.app"
$env:PRODUCTION_API_URL = "https://sti-vio-log.onrender.com"
npm run smoke:production
```

## Release decision

Release only when every applicable item passes, failures are documented and corrected, both Discipline Office accounts are individually provisioned, and no high- or critical-severity dependency or application-security issue remains.
# Unified authentication acceptance

- [ ] All roles sign in through `/login` without selecting a role.
- [ ] DISCIPLINE_ADMIN, DISCIPLINE_OFFICE, DEPARTMENT_HEAD, and STUDENT reach only their authorized dashboard.
- [ ] DISCIPLINE_ADMIN can open both the operational dashboard and `/admin/system-monitoring` without another verification prompt.
- [ ] Account lock and recovery require a single-use password confirmation bound to the selected account and action.
- [ ] Staff-issued students cannot enter the portal before password change, staff-recorded Gmail OTP, matching Google binding and profile completion.
- [ ] Onboarding OTP expires, cannot be reused, and resend invalidates the previous code; public signup/linking remains unavailable.
- [ ] Forgot-password responses do not reveal whether a Student account exists.
- [ ] Password reset requires OTP verification and a single-use reset authorization.
- [ ] Existing sessions stop working after a successful password reset.
- [ ] Only DISCIPLINE_ADMIN can create or manage staff and Department Accounts.
- [ ] Temporary-password accounts cannot call business APIs until changing password.
- [ ] Password fields have keyboard-accessible show/hide controls.
- [ ] Brevo HTTPS variables and approved sender are configured before controlled email testing; no automatic SMTP failover is assumed.


## College and SHS academic acceptance

- [ ] Complete onboarding for College BSIT Year 2, ABM Grade 11, and STEM Grade 12 test accounts.
- [ ] Verify required strand/program, section, guardian data, and mode-specific year validation.
- [ ] Verify audited staff corrections and unrelated edits to legacy College years 5-8 and SHS records without a strand.
- [ ] Verify profiles, QR details, directory search, reports, and certificate preparation show the correct program/strand and year/grade.
- [ ] Confirm migration 043 preserves access, onboarding state, historical programs, and issued certificates.


## College and Senior High School support

The system supports College programs (years 1-4 for new academic submissions) and Senior High School **ABM** (Accountancy, Business, and Management) and **STEM** (Science, Technology, Engineering, and Mathematics), Grades 11-12. SHS requires a strand and section instead of a College program. Both modes retain the same Student role and authorization rules. See the [student academic model](STUDENT-ACADEMIC-MODEL.md) for account setup, audited corrections, API fields, historical records, migration 043, and acceptance examples.
