# Vercel and Supabase production deployment

## Required architecture

Deploy the Vite frontend on Vercel and the Express API on Render. Vercel proxies `/api/*` and `/socket.io/*` to Render, so the browser sees a single origin and host-only `SameSite=Lax` cookies remain first-party. Use Supabase only as PostgreSQL: browser code must never receive the database password, service-role key, or a direct STI Vio-Log table grant.

The browser must use the Vercel origin for API requests. `frontend/vercel.mjs` builds the same-origin proxy from the environment-scoped `API_PROXY_ORIGIN`; it fails non-production builds that match `PRODUCTION_API_ORIGIN`. Do not configure browser requests to bypass that proxy. Custom same-site domains remain recommended if they are added later.

## Vercel frontend

Set these encrypted environment variables for Production (and separately for Preview if previews are allowed):

- `VITE_API_URL` is used only during local development. Production builds use the same-origin Vercel proxy.
- `VITE_GOOGLE_CLIENT_ID` for a Google web client authorized only for the exact frontend origin.

Build from `frontend` with `npm ci && npm run build`. The build injects an exact CSP for the configured API and WebSocket origins. `frontend/vercel.mjs` also supplies HSTS, anti-framing, nosniff, referrer, permissions, opener, and resource-policy headers. After changing an environment variable, create a new deployment; existing deployments do not inherit the change.

Do not expose server secrets with a `VITE_` prefix. Disable public Vercel previews or give Preview a separate non-production API/database and explicit origin.

## Supabase database

Use two connection strings:

- `DATABASE_URL`: Supabase transaction pooler URL (port 6543) for the serverless/runtime application. The application automatically limits a Vercel pool to one connection.
- `MIGRATION_DATABASE_URL`: direct connection or session pooler URL (port 5432) for migrations, held only by the deployment/migration job.

Require verified TLS and never set `DB_SSL=no-verify` in production. Enable Supabase SSL enforcement. Migration 034 revokes `anon` and `authenticated` access to application tables and enables RLS so the Supabase Data API cannot become an accidental bypass. If the Data API is not used by any other schema, disable it or expose a separate empty schema in Supabase API settings.

Migration 034 creates the non-login `sti_vio_log_runtime` permission group, grants it application DML through a dedicated RLS policy, and permits only SELECT/INSERT on audit stores. In the Supabase SQL editor, create a unique password-manager-generated login and grant the group to it:

```sql
create role sti_vio_log_app with login password '<PASSWORD-MANAGER-GENERATED SECRET>';
grant sti_vio_log_runtime to sti_vio_log_app;
```

Use that login in `DATABASE_URL` and test the provider-specific pooler username format. The production readiness check rejects an owner, superuser, database/role creator, RLS-bypass role, or login without this membership. Keep the owner/migration credential out of the runtime environment. Rotate any database credential that was ever copied into source, chat, logs, or a frontend setting.

## Backend secrets

Set all of these as encrypted production-only variables:

- `NODE_ENV=production`
- `FRONTEND_URL=https://app.school.edu` (comma-separated only when every origin is intended)
- `DATABASE_URL` and deployment-only `MIGRATION_DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `SESSION_HASH_KEY`, `CSRF_SIGNING_KEY`, `OTP_HASH_KEY`, `AUTH_THROTTLE_KEY`, `MFA_RECOVERY_KEY`, and `CERTIFICATE_SIGNING_KEY`: independent random values of at least 32 bytes
- `MFA_ENCRYPTION_KEY`: exactly 32 random bytes encoded as Base64
- `TRUST_PROXY_HOPS`: the validated proxy-hop count for the API host (normally `1`, but confirm with the host)

Never reuse keys between purposes. Startup rejects missing, short, placeholder, or insecure settings. Keep the legacy `JWT_SECRET` independent while any short-lived reset/verification challenge still uses JWT; those tokens are algorithm-, issuer-, audience-, purpose-, and lifetime-bound.

## Release procedure

Run migrations once with the owner credential before routing traffic, then start the API with only the runtime credential. `npm start` deliberately does not apply migrations; it fails closed when a migration is pending. Run `npm run migrate` as a separate controlled release step with `MIGRATION_DATABASE_URL`, then remove that owner credential from the running service.

After deployment verify:

1. `GET /api/health` returns 200 without disclosing configuration.
2. Login sets host-only `HttpOnly; Secure; SameSite=Lax` `sti_session`, and no token appears in local storage or JSON.
3. Every authenticated mutation without a matching `X-CSRF-Token` fails.
4. An unapproved Origin fails for HTTP and Socket.IO.
5. DISCIPLINE_ADMIN must enroll/verify TOTP before API access; recovery codes work once.
6. Student, department, administrator, forced-password, ownership, and deactivated-account boundaries hold.
7. CSP has no violations during Google login, MFA, QR camera, exports, certificates, and realtime use.
8. Supabase Table Editor confirms RLS enabled and `anon`/`authenticated` have no table privileges.
9. Run `npm run smoke:production` with `PRODUCTION_FRONTEND_URL` and `PRODUCTION_API_URL` set locally.

## Rollback and rotation

Keep the previous application release available. Do not edit or reverse an applied migration manually. Restore into an isolated database before switching connections. Key rotation must deploy new keys, revoke all browser sessions, invalidate outstanding challenges, and retire the old keys after the maximum eight-hour session lifetime. A suspected database or session-key leak requires immediate credential rotation and incident review.
