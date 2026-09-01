# Final Acceptance Checklist

Run this checklist on a dedicated test student and test violation. Do not use a real disciplinary record. Record the date, tester, device, and pass/fail result for every section.

## 1. Prepare controlled test identities

- [ ] Create two distinct Discipline Office accounts and one Admin account. Each person receives only their own temporary password and changes it at first sign-in.
- [ ] Create Department Account A and Department Account B for two different active departments.
- [ ] Prepare one unlinked Google test account and one issued Student Number/password account.
- [ ] Confirm every test account can log out and that a revoked or deactivated account cannot reuse an old session.

Never place passwords, Google credentials, or JWTs in screenshots or test notes.

## 2. Student registration and authentication

- [ ] Register the Google test student using a new Student Number and complete the Discipline Office review.
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
- [ ] Department A records Time-Out and a service condition from the live monitor or QR scanner.
- [ ] Confirm worked minutes are non-negative, derived from server timestamps, and immediately credited up to the remaining requirement without Discipline Office approval.
- [ ] Test camera denial and manual QR entry; both must show usable instructions without a blank screen.

## 5. Supporting workflows

- [ ] Student and Discipline Office can open the same conversation, exchange replies, and clear unread badges by reading it.
- [ ] Department Accounts cannot open student messaging or guardian contact information.
- [ ] Discipline Office records a manual parent/guardian contact attempt and it appears in the append-only log.
- [ ] Notifications appear for the intended student and do not expose another student's information.
- [ ] Clearance and good-standing results match unresolved violations and remaining approved service hours.
- [ ] Reports and CSV exports use the selected filters, contain the expected records, and do not expose passwords, tokens, guardian data, or raw internal IDs unnecessarily.
- [ ] Audit history identifies the individual Admin or Discipline Office account responsible for each tested action.

## 6. Security and recovery

- [ ] Verify Admin-only account deletion/recovery actions are unavailable to other roles.
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
