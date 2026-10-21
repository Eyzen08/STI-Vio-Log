# Vercel, Render and Supabase production deployment

## Current domain — October 21, 2026

The canonical frontend is [stiviolog.com](https://stiviolog.com). Keep `sti-vio-log.vercel.app` available. The `www.stiviolog.com` alias should redirect permanently to the canonical domain while preserving paths and query strings. GoDaddy DNS already points to the existing Vercel project; preserve the current nameservers and unrelated records.

The existing Render service remains `STI-Vio-Log` (`srv-da2auknqj5pc73ec08ag`) in `My Workspace`, serving `https://sti-vio-log.onrender.com`. Put `https://stiviolog.com` first in `FRONTEND_URL`, retain approved origins, and include both `https://www.stiviolog.com` and `https://sti-vio-log.vercel.app`. Apply that setting with a merge, preserving every unrelated variable, and deploy before switching the canonical redirect. Google Cloud's existing Web Client must authorize `https://stiviolog.com`; retain working origins and the existing client ID. If Google Console access is unavailable, the owner must apply this setting before the canonical switch.

The social preview is `frontend/public/social-preview.jpg` (1200 × 630), referenced as `https://stiviolog.com/social-preview.jpg?v=20261021-2`. It highlights the **STI Global City Discipline Office Portal** using the real night-campus photograph, a recognizable building/STI sign, softly blended dark edges, and sharp white/yellow text. The icon-generation script intentionally leaves this generated image alone. Stage a production deployment, verify metadata/image, routes, API proxy and CORS, then promote that tested deployment. Use `PRODUCTION_FRONTEND_URL=https://stiviolog.com` and `PRODUCTION_API_URL=https://sti-vio-log.onrender.com` for the read-only production smoke check. Check Google sign-in with an authorized test account; existing shared previews may need a refresh. Historical deployment snapshots below retain their original URLs and verification limits.

The Discipline Office preview revision also updates Vite from locked 8.2.1 to 8.2.4 (manifest range `^8.2.4`) to resolve the development-tool advisories observed during the initial domain rollout. Keep the existing dependency-audit gate enabled. The earlier domain commits and this preview revision belong on `main`; preserve unrelated local edits when committing or creating a release archive.

The release also repairs shell quoting and error handling in the existing tracked-secret guard. Its self-check covers clean source, a disposable fake secret, scanner errors, and a tracked `.env` file. The full-history Gitleaks exception for `d4a8623828d2a56e2560ce370137730f85929b1b:docs/AUDIT-REPORT.md:generic-api-key:127` applies only to the historical feature-traceability prose finding; full-history scanning remains enabled.

Configuration verified October 21: the existing Google client already authorizes both new HTTPS origins and retains its local/Vercel origins. Render deployment `dep-dbc31cks728c73dqok9g` is Live with the canonical origin first; all 29 environment-variable names remain present. Read-only preflights accepted the apex, `www`, and Vercel origins and rejected an unapproved origin. Actual Google sign-in still requires an authorized test account.

Frontend release `dpl_9DPePYDeGQnnnm66RExoCAAy95Pe` was staged from a clean archive of commit `25f0af6`, tested, and promoted. Public apex and Vercel URLs serve the new metadata; `www` redirects with path/query preserved. Production smoke passed, and the public JPEG matches the repository image by SHA-256. Facebook Sharing Debugger fetched the new canonical URL and rendered the new preview. Frontend tests passed 469/469, lint/build passed, and targeted backend tests passed 20/20. The local ISP intercepted the plain HTTP probe, so that redirect was not verified; direct HTTPS passed. The build reported existing high-severity Vite development-tool advisories; dependencies were not changed by this release.

## Verified deployment snapshot — October 13, 2026

Production was verified on commit `b356e2b712c65a8f30fe52753f5a398028ab706b` (Refresh browser and Apple touch icons). It remained GitHub `main` at the final review on **October 13, 2026, 11:19–11:21 Asia/Manila**. [Security verification run 38258561658](https://github.com/Eyzen08/STI-Vio-Log/actions/runs/38258561658) completed successfully for this exact commit. The application release was performed October 12; the final alias correction and public checks were performed October 13. Dependencies, hosting plans, application code and database schema were not changed by this rollout. Later documentation-only releases can advance the deployed commit without changing application source; inspect the provider for the current live revision.

| Component | Release outcome | Evidence and remaining limits |
|---|---|---|
| Vercel frontend | **READY**, deployment `dpl_Hd4dPfaNtGarFGfSWBwikHFJN4dF`; public site [sti-vio-log.vercel.app](https://sti-vio-log.vercel.app) | Existing project remains Vite, root `frontend`, output `dist`, Node 24.x and build `npm run build`. Install command changed to `npm ci`; remote build completed with zero reported dependency vulnerabilities. |
| Render API | **Live**, deployment `dep-db6ep6vlk1mc73d0e8j0`, pinned to `b356e2b` | Invalid pre-deploy command `--confirm` cleared; health check set to `/api/health`. Existing build/start commands, Free plan, one instance, Oregon and preview policy retained. Startup logged: `Production readiness passed: database connected; 50 migrations current.` |
| Supabase PostgreSQL | **Current**, all 50 repository migration filenames exactly match `public.schema_migrations` | No pending or unexpected migration names; no migration executed. All 49 public tables remain RLS-enabled. Runtime login/group metadata is nonprivileged; fresh API startup passed the existing database-security checks. |
| Google identity | **Configuration matches** | Frontend/backend public Google client IDs privately compared and matched. Google Cloud origin settings and an actual sign-in remain unverified. |
| Brevo email | **Sender metadata active; delivery unverified** | Connected provider returned two active project senders. Render email key/sender variables are present. Sender lookup using the backend's configured key returned HTTP 401 with an inspection-IP restriction; matching that key's sender remains unverified. No email was sent and no IP allowlist changed. |
| GitHub CI / Git integration | **Release CI passed; Vercel Git deployment path unresolved** | Repository ID, owner, project link and commit matched. Recent Vercel Git-backed production attempts failed with `git_info_fail` before building; the release used the authenticated local CLI fallback. Future automatic Git deployments have not been proven repaired. |

All three existing Vercel aliases were checked against the release deployment: `sti-vio-log.vercel.app`, `sti-vio-log-eyzen08s-projects.vercel.app` and `sti-vio-log-git-main-eyzen08s-projects.vercel.app`. Promotion updated the production aliases; the `git-main` alias required explicit reassignment on October 13.

The CLI upload came from a clean `git archive` of the release commit. A dry run verified all **649 uploaded files** belonged to that commit. The original workspace dry run included ignored backups and unrelated work folders, so it was not deployed. Locally configured environment files, backups and unrelated work folders were excluded from upload. The build was staged with `--prod --skip-domain`; authenticated `vercel curl` checks passed before promotion. Deployment Protection was retained.

### Verification performed

- Staged and public `/` and `/login` returned the application HTML. All 31 directly linked assets returned nonempty, non-HTML content; browser and Apple touch icons matched the release files byte-for-byte by SHA-256.
- Public responses included CSP, HSTS, anti-framing, nosniff, referrer and permissions headers. Same-origin `/api/health` confirmed database connectivity.
- The existing production smoke check passed after release and again October 13: direct API health, frontend route, frontend API proxy, unauthenticated protected-endpoint rejection, approved-origin preflight and rejected unapproved origin.
- Private configuration comparisons confirmed production environment names, canonical frontend allowlisting, matching proxy origins and Google IDs, required secret presence, verified database TLS settings with a CA, the expected dedicated runtime login, and absence of `MIGRATION_DATABASE_URL` from Render runtime settings. No secret values were written to evidence files or documentation.
- The release Vercel error-log query returned no entries. Render's October 12 release scan returned two CORS rejections at the times of the deliberate unapproved-origin smoke probes; no other error entries were returned in that window. This is a bounded release scan, not continuous monitoring.

### Preview audit — October 12, 2026

All 46 Vercel preview deployment records were inspected: 14 latest deployments for open PR branches, 18 superseded deployments on those branches, and 14 deployments on closed branches classified as historical. Every open branch's latest deployment record matched its current head. These are frontend deployment records, including for backend-only dependency PRs; they do not represent deployed preview APIs.

| Open PR | Branch suffix after `dependabot/` | Head / deployed commit | Build state | Latest deployment |
|---|---|---|---|---|
| #16 | npm_and_yarn/backend/google-auth-library-11.1.0 | `918d240` | READY | `dpl_A7XjZgQAEaXyExsZPW1iTxMWRYZT` |
| #15 | npm_and_yarn/frontend/globals-17.12.0 | `a05ac65` | READY | `dpl_7G9XfioVSmn8MLisP4khSDsNdyFk` |
| #14 | github_actions/github/codeql-action/analyze-4.38.0 | `a8ea2cd` | READY | `dpl_5tnyLe43RQYYg6A8rTV5aHnU5y74` |
| #13 | github_actions/github/codeql-action/init-4.38.0 | `9f17799` | READY | `dpl_5TETffMpCTbdigUS2QLEGATqhwwj` |
| #12 | npm_and_yarn/frontend/multi-7f19880bf6 | `ae5412a` | ERROR (`git_info_fail`) | `dpl_i9RneWEd29HyLenDpRNMdHJp8gtt` |
| #10 | npm_and_yarn/frontend/multi-de36fa8f59 | `21edaeb` | READY | `dpl_Dy8w2vD6dNNpPrsKQ3foZu8898c7` |
| #9 | npm_and_yarn/backend/pdfkit-0.20.2 | `a916f8a` | READY | `dpl_8FDHcZDYRLXa6EsxzSCQSPxW8DSD` |
| #8 | npm_and_yarn/backend/socket.io-4.8.3 | `81ee0ed` | READY | `dpl_G3mmamUTcBASbWKL7deoSWtX62jr` |
| #7 | npm_and_yarn/frontend/vitejs/plugin-react-6.1.1 | `2672770` | READY | `dpl_D6btK9vq4gHkKCVqqCNCithDykHF` |
| #5 | npm_and_yarn/backend/express-rate-limit-8.7.0 | `632cc74` | READY | `dpl_AMz3KfK3D6AUgcKF85Exv5qDzkQr` |
| #4 | github_actions/actions/checkout-7.0.1 | `f17ff36` | READY | `dpl_DCMgcvqDCgFZi2DK4CnLsPEMSj6D` |
| #3 | npm_and_yarn/frontend/socket.io-client-4.8.3 | `400b732` | READY | `dpl_DWFK7qTmyvTeSdXbstE8kHNf8vG8` |
| #2 | github_actions/actions/upload-artifact-7.0.1 | `38bad45` | READY | `dpl_7tCV6TZoQYa1WH8T7oiL8emwLrRb` |
| #1 | github_actions/actions/setup-node-7.0.0 | `54e187b` | READY | `dpl_639YBPzrCzMZrxhmtnS3X8GvMmkq` |

**Every active preview remains blocked for functional verification/rebuild:** Vercel Preview has neither `API_PROXY_ORIGIN` nor `PRODUCTION_API_ORIGIN`, and Render has no isolated preview API/database. READY establishes only build completion. No preview was rebuilt or pointed to production, no PR was merged, and no historical deployment was deleted. Provision approved isolated services before validating these branches end-to-end; retry the failed Git deployment only after that isolation exists.

### Rollback and remaining checks

Prior working frontend: `dpl_Bf5T3YJNX8JGbKeMMaxuV6z34oka`, commit `15e4a9965b7c7b9d1683138bbb6c1237ced4da72`. Prior working backend: `dep-db6cafbbc2fs739i72mg`, commit `ba45922047c4860ef3da68b02b445f55ef1cf3b4`. No rollback was needed. If a later failure requires rollback, restore the application deployment and verify every alias; do not automatically reverse database migrations.

Authenticated role workflows, Google sign-in completion, email delivery, camera behavior and backup/restore remain unverified. Sixteen unused Supabase/Postgres-related Vercel environment-variable names were observed and left unchanged; their presence does not establish browser exposure. Review that provider integration separately. Private redacted evidence and assert-based checks are in ignored `.cache/deployment-update/`, which may not exist in another checkout. The earlier audit below is retained as historical evidence.

## Historical deployment inventory — October 10, 2026

Source baseline: `3601e16031c36d08308176d9c7807d02198ac7b8`. Read-only provider inspections matched repository/project identity before use. No deployments, settings, environment values, shared migrations or messages were changed. Instructions below are requirements/recommendations, not proof that all live settings match them.

| Platform/category | Responsibility/component | Source/configuration | Observed status | Verification needed / limitation |
|---|---|---|---|---|
| Vercel/frontend | Vite frontend and same-origin API/polling proxy | `frontend/vercel.mjs`, `vite.config.js`; proxy origins, Google public client | Matched `sti-vio-log`, root `frontend`, Vite, `dist`, Node setting 24.x, build `npm run build`, **install `npm install`**. Latest production READY deployment matches audited SHA. Canonical frontend/proxy smoke passed. | Exact runtime, previews and authenticated browser flows unverified. Prefer locked `npm ci` in a separately approved provider change. |
| Render/API | Long-lived Express/Socket.IO | `backend/package.json`, `src/server.js`; origin, database/email/security variables | Matched repository/main, root `backend`, Node **Free** service, Oregon, one instance, automatic commit deployments, previews off. Build `npm ci --omit=dev && npm audit --omit=dev --audit-level=moderate`; start `npm start`. Latest **Live** deployment matches audited SHA. Health/CORS smoke passed. | Release-command and health-check configuration require owner review; detailed control-plane observations are retained privately. No release command was executed. Runtime environment-name inventory/login/TLS and exact runtime unavailable. |
| Supabase/database | PostgreSQL for API, no browser Auth/Storage SDK | Migrations, `src/config/database.js`; runtime/owner URL and TLS names | Matched ACTIVE_HEALTHY project, Tokyo; PostgreSQL **17.6**. All **50 migration filenames** recorded, 49 public tables all RLS-enabled, no anon/authenticated CRUD/public app-function grants in inspected metadata. Nonprivileged app login/runtime group exist. | Actual Render login/pooler/TLS, Data API settings, backups/PITR/retention/restore unverified. Owners can bypass non-FORCE RLS. |
| Brevo/email | Backend HTTPS OTP/reset/credentials/certificates | `emailService.js`; `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, name/timeouts | One connection errored; another existing connection returned two active project-named senders. Addresses withheld. | Active sender metadata does not prove Render configuration or delivery. Controlled tests needed; no mail sent. |
| Google/identity | Student ID-token verification/binding | GIS helper, `googleIdentityVerifier.js`; matching public client IDs | Source integration and Vercel client variable name present. | Google Cloud origins and live OAuth unavailable. No client secret needed for this flow. |
| GitHub/repository and CI | Source, Actions, Dependabot | `.github/workflows/security.yml`, `.github/dependabot.yml` | Configuration inspected; connected commit lookup returned no PR-triggered runs in its limited scope. | This does not establish absent CI. Full Actions lookup could not execute because automatic approval review hit a usage limit. Job outcomes/branch protection unavailable. |
| Vercel Analytics/analytics | Optional frontend dependency | Manifest; no entry-point loading | **Inactive** in current source. | Logged-in network absence and institutional activation approval unverified. |

Vercel and Render deployment snapshots around **13:16 Asia/Manila, October 10** match the audited commit. Migration 050 metadata records approximately **11:09 Asia/Manila**. These are snapshots, not availability history or workflow certification.

Provider environment names/presence were inspected without retrieving values. The public source configuration inventory is in TECH_STACK.md; the detailed live inventory is retained privately. The owner must verify necessity, least privilege and Production/Preview isolation. Vite normally exposes VITE-prefixed values; environment-name presence alone does not establish browser exposure.

## Current architecture and request flow

```mermaid
flowchart LR
    Browsers[Student and staff browsers] --> Vercel[React and Vite on Vercel]
    Vercel -->|Same-origin API and Socket.IO polling proxy| Render[Express on Render]
    Render --> Auth[Session CSRF permissions ownership validation]
    Auth --> Logic[Routes controllers and services]
    Logic -->|pg queries and transactions| DB[Supabase PostgreSQL]
    Browsers --> GIS[Google Identity Services]
    Logic -->|Verify ID token| GIS
    Logic -->|HTTPS email| Mail[Brevo]
    GitHub[GitHub commits] -->|Automatic deployment triggers| Vercel
    GitHub -->|Automatic deployment triggers| Render
```

Google/mail source branches exist; live completion was not tested. Email is synchronous with timeout/errors and no durable queue. Socket.IO sends scoped refresh signals after committed writes; REST remains authoritative. Database pooling belongs to Render, not a currently deployed Vercel backend function.

## Operational limits and recommendations

**Current limits:** one Free API instance; unresolved Vercel Git-backed deployment errors; no isolated preview API/database; no verified backup/PITR/restore; no full authenticated/browser/load/security evaluation; email delivery unverified; backup-storage review pending; retired registration tables retained; legal acknowledgment disabled. Health alone does not establish handover readiness.

**Remaining recommendations:** repair and verify the Vercel Git deployment path, establish preview isolation, confirm actual proxy-hop topology, review unused frontend provider variables, approve backup/restore monitoring/retention, and test controlled Google/email/camera/revocation journeys. Locked installs, the API health check and runtime least-privilege/TLS configuration were verified in the October 12–13 release above. Keep owner credentials out of frontend/runtime services and migrations out of runtime startup. [The audit](AUDIT-REPORT.md) retains earlier findings and next actions.

## Required architecture

Deploy the Vite frontend on Vercel and the Express API on Render. Vercel proxies `/api/*` and `/socket.io/*` to Render, so the browser sees a single origin and host-only `SameSite=Lax` cookies remain first-party. Use Supabase only as PostgreSQL: browser code must never receive the database password, service-role key, or a direct STI Vio-Log table grant.

The browser must use the Vercel origin for API requests. `frontend/vercel.mjs` builds the same-origin proxy from the environment-scoped `API_PROXY_ORIGIN`; it fails non-production builds that match `PRODUCTION_API_ORIGIN`. Do not configure browser requests to bypass that proxy. Custom same-site domains remain recommended if they are added later.

Production frontend builds, including deployed previews, use Socket.IO HTTP long-polling through `/socket.io/*` with WebSocket upgrades disabled. This still delivers live events and preserves first-party session cookies through the existing proxy. Local development connects with polling first and may upgrade to WebSocket. The proxy explicitly rewrites `/socket.io/` as well as its subpaths so the trailing-slash handshake cannot fall through to the SPA. Deploy both the frontend routing fix and the backend request policy; no database migration is required.

The backend accepts an allowlisted `Origin`, or a polling GET with no `Origin` only when `Sec-Fetch-Site` is `same-origin` and the `Referer` origin is allowlisted. Preserve these browser headers through the proxy. An explicitly unapproved `Origin` always fails, and every Socket.IO connection still requires a valid browser session.

## Vercel frontend

Set these encrypted environment variables for Production (and separately for Preview if previews are allowed):

- `VITE_API_URL` is used only during local development. Production builds use the same-origin Vercel proxy.
- `VITE_GOOGLE_CLIENT_ID` for a Google web client authorized only for the exact frontend origin.

Build from `frontend` with `npm ci && npm run build`. The build injects an exact CSP for the configured API and WebSocket origins. `frontend/vercel.mjs` also supplies HSTS, anti-framing, nosniff, referrer, permissions, opener, and resource-policy headers. After changing an environment variable, create a new deployment; existing deployments do not inherit the change.

Do not expose server secrets with a `VITE_` prefix. Disable public Vercel previews or give Preview a separate non-production API/database and explicit origin.

## Supabase database

Use two connection strings:

- `DATABASE_URL`: provider-approved runtime pooler/direct URL with the dedicated app login. Transaction pooling commonly uses port 6543; confirm provider settings. The current Render process defaults to ten pooled connections; the conditional one-connection Vercel behavior is not the observed backend deployment.
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

Never reuse keys between purposes. Startup rejects missing, short, placeholder, or insecure settings. Keep legacy `JWT_SECRET` independent while required by readiness/development compatibility. Normal browser sessions and current reset authorizations use hashed opaque values; retained legacy bearer issuance is disabled in production. Configure `DEPLOYMENT_ENV` and `DATABASE_ENVIRONMENT` consistently with the readiness check and the selected email provider.

## Release procedure

Run migrations once with the owner credential before routing traffic, then start the API with only the runtime credential. `npm start` deliberately does not apply migrations; it fails closed when a migration is pending. Run `npm run migrate` as a separate controlled release step with `MIGRATION_DATABASE_URL`, then remove that owner credential from the running service.

If an automatic Render deployment fails because a migration is pending, apply the migration first and then explicitly redeploy the latest commit. A failed deployment does not automatically retry after the database becomes current, and an empty Git commit may not create a new Render deployment.

For the College / Senior High School ABM/STEM release, confirm migrations `042_student_academic_level.sql` and `043_student_academic_strands.sql` exist in the checkout and are applied before redeploying the backend. On Windows, run the masked migration helper from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\migrate-production.ps1
```

This uses `npm.cmd` to avoid PowerShell blocking `npm.ps1`, checks migration status before and after applying pending migrations, and clears the prompted credential afterward (restoring any prior process value). The execution-policy override applies only to this PowerShell process. Use the owner direct/session-pooler URL at the masked prompt; do not put it in the command or chat. Stop on any error. Confirm both migration 042 and `043_student_academic_strands.sql` are marked `applied`, then manually deploy the latest backend commit on Render and wait for Live. Verify the Vercel production `API_PROXY_ORIGIN` points to that backend HTTPS origin, redeploy the frontend if needed, and test College, ABM Grade 11, and STEM Grade 12 onboarding with test accounts. A healthy `/api/health` response alone does not verify that this migration or onboarding release is deployed.

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

For the realtime transport release, sign in with test accounts and filter the browser Network panel for `/socket.io/`. Confirm polling requests succeed and no WebSocket requests are attempted; a pending long-polling GET while waiting for events is normal. In two authenticated test sessions, confirm messages and attendance changes update automatically, a temporary offline interruption reconnects after network restoration, and logout stops the connection. If polling fails, inspect its response and Render logs for proxy, Origin, or session errors before declaring the release verified. Clear the Console before checking so historical WebSocket failures are excluded.

Verify a fresh MFA code completes login and an invalid code shows the expected authentication error. Invalid codes and expired MFA challenges should continue returning HTTP 401. Vercel Analytics loading is disabled; production network inspection must show no analytics script or collection requests.

## Privacy Notice and Terms technical release

Apply migration `050_terms_acknowledgments.sql` through the controlled migration process before deploying this backend release. The shared policy manifest keeps `enforcementEnabled: false`; the public pages contain factual corrections, while expanded legal wording stays in `docs/privacy-terms-review.md`. Confirm password, Google, MFA and restored sessions still reach the portal without acknowledgment. Check policy links from login and account settings, preserved return locations, visible versions and revision dates, and the absence of analytics requests.

After authorized administration and DPO approval, add immutable approved policy snapshots, update the shared published document imports, and enable enforcement in a reviewed release. Increment `acknowledgmentVersion` only when a material Terms update requires renewed acknowledgment. A notice update or editorial revision alone must not reset acknowledgment. The API derives user identity, hashes and timestamps; the Privacy Notice version records the notice offered, not consent or proof of reading. Confirm the owner-approved retention and minors procedures before activation. Keep runtime acknowledgment records read/insert-only and unexposed to Supabase public API roles.

For rollback, set enforcement false and redeploy the application. Preserve the acknowledgment table and migration history; owner-controlled retention or erasure must follow the institution's approved procedure.

## Rollback and rotation

Keep the previous application release available. Do not edit or reverse an applied migration manually. Restore into an isolated database before switching connections. Key rotation must deploy new keys, revoke all browser sessions, invalidate outstanding challenges, and retire the old keys after the maximum eight-hour session lifetime. A suspected database or session-key leak requires immediate credential rotation and incident review.


## College and Senior High School support

The system supports College programs (years 1-4 for new academic submissions) and Senior High School **ABM** (Accountancy, Business, and Management) and **STEM** (Science, Technology, Engineering, and Mathematics), Grades 11-12. SHS requires a strand and section instead of a College program. Both modes retain the same Student role and authorization rules. See the [student academic model](STUDENT-ACADEMIC-MODEL.md) for account setup, audited corrections, API fields, historical records, migration 043, and acceptance examples.
