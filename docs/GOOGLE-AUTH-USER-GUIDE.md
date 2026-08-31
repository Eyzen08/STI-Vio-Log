# Google registration and login user guide

## Student registration and login

1. Open `/student/login` or choose **Student Google access** from `/login`.
2. Select **Continue with Google** and use the student's own school Google account.
3. If the Google identity is already linked to an active Student record, the student enters the portal immediately.
4. On first use, enter the school-issued Student Number exactly as shown in the enrollment record, plus the student's first and last name.
5. When an existing school-managed Student record matches, the Google identity is linked and the student signs in.
6. When no record exists, a pending enrollment request is created. No portal session is granted yet.
7. An Admin or Discipline Officer opens **Registrations**, verifies enrollment, records a reason, and approves or rejects the request.
8. After approval, the student returns to `/student/login` and uses the same Google account.

Students never choose a Student ID or application role. One Google account cannot be linked to multiple portal users or used simultaneously for Student and Department registration.

## Department officer registration and login

1. Open `/department/login` or choose **Department Google access** from `/login`.
2. A new officer selects **Request a department account** to open `/department/register`.
3. Select **Continue with Google** using the officer's own school Google account. Shared Library, Guard, or office Google identities must not be used.
4. Enter officer first/last name, optional employee number, department type, requested official department name, and optional note.
5. Submission creates a pending request only. It does not grant QR scanning, student data, reports, or any portal session.
6. An Admin opens **Department Accounts**, verifies the officer, selects an existing active department, enters a reason, and approves or rejects the request.
7. If the official department is missing, the Admin creates it first under **Departments**.
8. After approval, the officer returns to `/department/login` and signs in with the same Google account.

Only Admin can approve a Department officer or assign department scope. Discipline Officers cannot grant staff roles.

## Production configuration checklist

- The frontend and backend use the same Google Web Client ID.
- Vercel defines `VITE_GOOGLE_CLIENT_ID` and the production `VITE_API_URL`.
- The backend defines `GOOGLE_CLIENT_ID` with the same public Web Client ID.
- Google Cloud lists both the local frontend origin and the exact Vercel production origin under **Authorized JavaScript origins**.
- The production backend allows the Vercel origin through `FRONTEND_URL`/CORS.
- `.env` files remain ignored; only placeholder values belong in `.env.example`.
- Restart or redeploy services after environment-variable changes.

No Google client secret is required for this ID-token verification flow. Google credentials and application JWTs must never be logged.
