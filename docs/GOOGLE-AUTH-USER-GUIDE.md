# Google registration and login user guide

## Mandatory Google binding for newly issued Student accounts

Students whose credentials were issued by the Discipline Office first sign in with their Student Number and temporary password. Staff provision the Student Number, legal name and personal Gmail; the backend creates the private QR value. After changing the temporary password, the student confirms the code sent to that read-only staff-recorded Gmail, then binds its matching Google identity. Newly issued accounts require personal Gmail; arbitrary Workspace/custom-domain addresses are not accepted by this provisioning workflow. Only the successfully confirmed and Google-matched address becomes the password-recovery email.

The student cannot open normal portal pages until the password, Google, and profile-information steps are complete. Student Number and legal name are read-only during onboarding. Returning Google sign-in resumes an incomplete setup at the correct step. Existing Student accounts are not retroactively placed into this workflow.

## Student registration and login

1. Open the unified `/login` page and expand **Continue with Google**.
2. Select **Continue with Google** and use the student's linked Google account. Microsoft Entra school accounts are not Google accounts.
3. A linked active Student identity signs in; incomplete onboarding/rebinding resumes before portal access.
4. An unknown identity cannot link by supplying a Student Number and name. Ask staff for issued credentials and complete authenticated onboarding. `POST /api/auth/google/link` is removed (404); binding uses `POST /api/account/student-onboarding/google-link`.
5. Historical pending registrations remain reviewable only by DISCIPLINE_ADMIN; no new public registration route is active.

Students never choose a Student ID or application role. One Google account cannot be linked to multiple portal users.

## Department Account access

Department Google registration and login are retired. Historical registration and identity records remain for audit history, but no public Department Google route is active. A Discipline Administrator provisions an individual Department Account with a temporary password and department assignment. The officer signs in through `/login` and must change the temporary password before using operational features.

## Production configuration checklist

- The frontend and backend use the same Google Web Client ID.
- Vercel defines `VITE_GOOGLE_CLIENT_ID` and the production server-side `API_PROXY_ORIGIN` (production browser requests use the same-origin proxy).
- The backend defines `GOOGLE_CLIENT_ID` with the same public Web Client ID.
- Google Cloud lists both the local frontend origin and the exact Vercel production origin under **Authorized JavaScript origins**.
- The production backend allows the Vercel origin through `FRONTEND_URL`/CORS.
- `.env` files remain ignored; only placeholder values belong in `.env.example`.
- Restart or redeploy services after environment-variable changes.

No Google client secret is required for this ID-token verification flow. Google credentials, opaque session values, and CSRF tokens must never be logged.


## College and Senior High School support

The system supports College programs (years 1-4 for new academic submissions) and Senior High School **ABM** (Accountancy, Business, and Management) and **STEM** (Science, Technology, Engineering, and Mathematics), Grades 11-12. SHS requires a strand and section instead of a College program. Both modes retain the same Student role and authorization rules. See the [student academic model](STUDENT-ACADEMIC-MODEL.md) for account setup, audited corrections, API fields, historical records, migration 043, and acceptance examples.
