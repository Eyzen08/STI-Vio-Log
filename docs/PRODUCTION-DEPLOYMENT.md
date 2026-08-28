# Production deployment runbook

## Architecture

Deploy the Vite frontend to Vercel (or an equivalent HTTPS static host), the Express backend to a managed Node host, and PostgreSQL to a managed database service with automated backups. Use separate production resources and credentials; never copy development `.env` files into Git.

## Frontend environment

- `VITE_API_URL`: exact public HTTPS backend origin, without a trailing slash.
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth web client ID authorized for the exact production frontend origin.

Build from `frontend` with `npm run build`. `frontend/vercel.json` rewrites non-asset client-side routes to `index.html`, allowing direct navigation and reloads while leaving built assets untouched.

## Backend environment

- `NODE_ENV=production`
- `JWT_SECRET`: unique random value of at least 32 characters
- `FRONTEND_URL`: exact comma-separated HTTPS frontend origins; localhost is rejected in production
- `GOOGLE_CLIENT_ID`: same approved Google web client ID
- `DATABASE_URL`, or every `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`
- `DB_SSL`: provider-appropriate TLS mode

The backend trusts one hosting proxy hop in production so rate limiting sees the client address. The hosting platform must terminate HTTPS and forward `X-Forwarded-Proto` and `X-Forwarded-For` correctly.

## Release procedure

From `backend`, with production environment variables provided by the hosting platform:

```powershell
npm ci
npm run migrate
npm run production:check
npm start
```

The readiness command validates configuration, database connectivity, and that every repository migration is recorded. It reports only status and counts, never environment values.

After deployment:

1. Require `GET /api/health` to return HTTP 200 and database `connected`.
2. Confirm an unapproved origin is rejected by CORS and the exact frontend origin is accepted.
3. Test Student and Department Google login using production-authorized origins.
4. Test Admin, Discipline Office, Department Head, and Student route boundaries.
5. Test account `PATCH` actions through the browser to verify CORS preflight behavior.
6. Verify logout, expired sessions, forced password changes, and session invalidation.
7. Verify mobile QR scanning over HTTPS on a real device.
8. Confirm provider backups and monitoring alerts are enabled.

## Rollback

Keep the previous backend/frontend release available. If application code fails but the migration is backward compatible, redeploy the prior release. Never reverse or edit an applied migration manually. If data recovery is required, follow `DATABASE-BACKUP-RECOVERY.md` and restore into a separate database before switching connections.
