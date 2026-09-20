# Google registration and login user guide

## Student registration and login

1. Open the unified `/login` page and expand **Continue with Google**.
2. Select **Continue with Google** and use the student's own school Google account.
3. If the Google identity is already linked to an active Student record, the student enters the portal immediately.
4. On first use, enter the school-issued Student Number exactly as shown in the enrollment record, plus the student's first and last name.
5. When an existing school-managed Student record matches, the Google identity is linked and the student signs in.
6. When no record exists, a pending enrollment request is created. No portal session is granted yet.
7. An Admin or Discipline Officer opens **Registrations**, verifies enrollment, records a reason, and approves or rejects the request.
8. After approval, the student returns to `/login` and uses the same Google account.

Students never choose a Student ID or application role. One Google account cannot be linked to multiple portal users.

## Department Account access

Department Google registration and login are retired. Historical registration and identity records remain for audit history, but no public Department Google route is active. A Discipline Administrator provisions an individual Department Account with a temporary password and department assignment. The officer signs in through `/login` and must change the temporary password before using operational features.

## Production configuration checklist

- The frontend and backend use the same Google Web Client ID.
- Vercel defines `VITE_GOOGLE_CLIENT_ID` and the production `VITE_API_URL`.
- The backend defines `GOOGLE_CLIENT_ID` with the same public Web Client ID.
- Google Cloud lists both the local frontend origin and the exact Vercel production origin under **Authorized JavaScript origins**.
- The production backend allows the Vercel origin through `FRONTEND_URL`/CORS.
- `.env` files remain ignored; only placeholder values belong in `.env.example`.
- Restart or redeploy services after environment-variable changes.

No Google client secret is required for this ID-token verification flow. Google credentials, opaque session values, and CSRF tokens must never be logged.
