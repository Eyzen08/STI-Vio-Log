# Technology stack and data architecture

Reviewed **October 10, 2026, Asia/Manila**, commit `3601e16031c36d08308176d9c7807d02198ac7b8`. Package installation is separate from source use and operational verification. [Deployment](PRODUCTION-DEPLOYMENT.md), [feature traces](FEATURE_TRACEABILITY.md) and [testing](TESTING.md) supply the corresponding evidence.

## Languages, runtimes and custom implementations

| Technology | Responsibility and evidence |
|---|---|
| JavaScript/JSX | Backend CommonJS, frontend ES modules/React, shared `.mjs` helpers, Node tests and scripts. Baseline: 339 `.js`, 78 `.jsx`, 16 `.mjs` tracked files. |
| SQL | 50 ordered migrations; parameterized SQL in controllers/services. No ORM or query builder. |
| HTML/CSS/SVG | Vite HTML entry, 19 CSS files, local image/icon/avatar assets. Custom responsive CSS and inline SVG; no Tailwind/component framework or chart package. |
| PowerShell | Two tracked scripts: migration helper and developer utility. JSON/YAML/Markdown/XML are configuration/documentation/assets, not additional application languages. |
| Node/npm | Both manifests require 24.x/11.x. Local checks: Node 24.18.1/npm 11.16.0. Vercel project setting is Node 24.x; exact deployed runtime is unknown. Render metadata reports Node, not an exact version. |
| PostgreSQL | Connected Supabase engine 17.6 observed through `version()`; provider build 17.6.1.155. Disposable local test engine/tools 18.6. CI declares PostgreSQL 17. |

No TypeScript application source was found; React `@types` packages and CodeQL language support do not make this a TypeScript application.

The frontend composes `src/App.jsx` and components with React hooks/context, hand-written forms and validators, native `fetch` in `src/lib/api.js`, and custom History API routing in `src/lib/routes.js`. It uses no React Router, Redux, Axios, Tailwind or form-schema library. Reporting/dashboard SVGs and CSV downloads are custom helpers; server Excel exports use ExcelJS. Themes, focus/modal behavior and responsive views are implemented in local components/styles. Source/SSR checks do not establish full accessibility.

The backend entry is `src/server.js`, despite the manifest's historical `main: index.js`. Express middleware applies origin/HTTPS/security/rate/error policies, session/CSRF checks and current permissions before route/controller/service operations. Validation lives in `src/utils/validators.js` and shared academic/name/display helpers. Socket.IO is scoped refresh communication, not a second authority for record writes.

## Authentication, documents and integrations

| Technology/service | Actual source use | Configuration and verification |
|---|---|---|
| bcrypt / Node crypto | Password hashes; HMAC-hashed opaque sessions/OTP/step-up/recovery values; TOTP implementation and encrypted MFA material. `browserSessionService.js`, `otpService.js`, `totpService.js`. | Independent session/CSRF/OTP/throttle/MFA keys. Unit and synthetic DB evidence; administrator login not tested live. |
| jsonwebtoken | Retained legacy `sessionTokenService.js`; production bearer-session issuance explicitly disabled. Current browser routes issue opaque cookies. | `JWT_SECRET` still required by readiness/configuration and development compatibility. Do not describe it as the normal production login or reset token. |
| Google Identity Services / google-auth-library | Browser Google ID credential; `googleIdentityVerifier.js` verifies audience and verified identity before `googleIdentityService.js` binding/login. No Google data API access. | Matching `VITE_GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_ID`; exact OAuth origin settings and live login unverified. |
| Brevo HTTPS / native fetch | `emailService.js` sends OTP, recovery, explicit student credentials and certificate attachments. | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, optional name; default timeout 10 seconds. Active sender metadata observed, actual Render configuration/delivery unknown. |
| Nodemailer SMTP | Alternative email provider when Brevo is not selected at construction. | `SMTP_*`, `MAIL_FROM`; it is not automatic retry/failover after Brevo errors. No delivery executed. |
| Socket.IO | `backend/src/realtime.js`, `realtimeEventService.js`, frontend `lib/realtime.js`. Cookie-authenticated user/role/department rooms, per-emission reauthorization and periodic checks; REST refresh. | Production polling through Vercel, upgrades disabled; local polling/WebSocket. Mocked security/transport checks pass; live authenticated reconnect/revocation unverified. |
| QR libraries | `qrcode` generates opaque student QR; `html5-qrcode` handles camera decoding in `StudentQr.jsx`/`DepartmentQrScanner.jsx`. | No remote attendance API. Backend authorizes assignment/supervisor and writes server-timed sessions. Physical cameras untested in this audit. |
| PDFKit / signature images | `clearanceCertificateService.js` renders A4 landscape **Certificate of Compliance** with PNG/JPEG signatures. PostgreSQL stores immutable issued PDF/signature snapshots and SHA-256. | `CERTIFICATE_SIGNING_KEY` authenticates verification references; this is electronic image signing, not PKI PDF signing. No production PDF/email workflow executed. |
| ExcelJS / custom CSV | Backend `reportExport.js`, `auditExport.js` and report controllers; frontend download helpers. | Authorized filtering and formula neutralization. Tests pass; realistic volume/untrusted dataset exports untested live. |
| Vercel Analytics | Dependency exists; no Analytics import/component in `frontend/src/main.jsx`. | **Inactive installed dependency**. Shared privacy decision disables loading; live network inspection remains needed. |

No browser Supabase SDK, Supabase Auth/Storage/Realtime integration, SMS gateway, webhook handler, durable worker queue or additional hosting provider was identified in active source. Historical references to Railway, Tailwind or public department Google registration are proposals/history.

## Database objects and relationships

All 50 migration files were inventoried and inspected for their schema/security changes. Fresh and legacy migration execution passed on the disposable cluster. Connected metadata showed **49 public ordinary tables, 142 indexes, 98 foreign keys, 98 check constraints and no public views**. These are catalog counts, not record counts. No student, message or email contents were queried.

| Object group | Tables and relationships |
|---|---|
| Accounts and identity | `users` → `students`, `staff_profiles`, `admin_profiles`, `department_heads`; unique username/student number/QR. Active Google links use partial unique indexes on user/subject; revoked identities remain historical. |
| Departments and supervision | `departments`, `officer_availability`, `officer_department_assignments`; session officer history tracks authorized changes. Current responsibility windows use the database clock. |
| Discipline and service | `violation_types` → `violations` → unique per-violation `community_service_assignments`; `violation_actions` preserves lifecycle history; `student_offense_escalations` caches an ALL_HISTORY indicator excluding invalid/cancelled cases. |
| Attendance and correction | Assignments → `community_service_sessions`, legacy `community_service_attendance`, `community_service_progress_history`, `community_service_session_officer_history`, `community_service_hour_corrections`; `qr_scan_logs` records scans. |
| Guardian and communication | `student_guardians`, `parent_contact_logs`; `message_conversations`, `conversation_messages`, `conversation_reads`; `notifications` has event deduplication/targets and per-user read/ack state. Old `messages` remains legacy storage. |
| Clearance/documents | `student_clearance`, `discipline_officer_signatures`, `clearance_certificates`, `clearance_certificate_signatures`; PDFs and signatures are PostgreSQL bytes, not external object storage. |
| Authentication/security | `browser_sessions`, `auth_otps`, `password_reset_authorizations`, `user_mfa`, `mfa_recovery_codes`, `mfa_challenges`, `authentication_throttles`, `administrative_step_up_tokens`. |
| History/policies/media | `audit_logs`, `administrative_security_events`, `high_risk_action_requests`, `support_access_requests`, historical password/Google registrations, `terms_acknowledgments`, `user_avatar_photos`. Retired routes do not imply deleted tables. |

The initial schema includes foreign-key delete restrictions as well as cascades; deletion is not uniformly soft. In particular, `studentController.deleteStudent` still attempts physical deletion; see the retention finding in [the audit](AUDIT-REPORT.md). Migration counts do not equal table counts, and schema definitions do not prove institutional retention approval.

### Integrity, concurrency and dates

The migration runner takes an advisory lock, applies one file per transaction and records the filename only after success. It tracks names rather than content checksums; never edit an applied migration. Integration status queries are not inherently read-only because they can create the tracking table.

Attendance locks the student before the assignment/session, rechecks current scanner/supervisor scope, and uses a unique active-student index. Time-out saves compatibility events, completed session, actual worked minutes, capped credit, progress, violation/clearance synchronization, notifications and audit within a transaction; rollback tests exercise failure paths. Duplicate time-out handling is idempotent where the completed session is recognized. Wire modes are FIXED and OPEN_TIME. Fixed targets are normally whole hours 2–8, with exact final remainder allowed; the target controls timer/outcome, not the credit ceiling, so eligible overtime continues until remaining work/day/midnight cutoff. Whole-minute normal credit and fractional final credit are distinct from actual elapsed work. Corrections preserve six-decimal cached balances while accepted edit inputs allow two decimals.

Service-day limits and DTR filtering use **Asia/Manila**. `communityServiceSessionReportController.js` applies Manila midnight boundaries; stored timestamps are timezone-aware. Shared display helpers format Manila dates. Do not generalize this to every date field: certificate numbering/issue date currently uses `new Date().toISOString().slice(0,10)` (UTC), a documented boundary risk needing follow-up. Violation incident date/time is recorded separately. ALL_HISTORY offense/good-standing calculations do not implement an authoritative academic-term relation.

Reporting exposes distinct measures: assignment lifetime completed/remaining hours, date-filtered session work/credit, and separate corrections. DTR has attendance rows plus an `hourCorrections` array, so an assignment with only corrections need not appear as a session row. Invalid/cancelled cases retain evidence, do not create active clearance obligations or offense counts; failed email does not revoke an issued PDF. New pending approval is not required for normal time-out, while old pending service results retain review routes.

### Grants, pooling, TLS and retention

Source migrations 034/035/040 and later table migrations enable RLS and remove Supabase public API grants. Connected catalog evidence: all 49 public tables RLS-enabled, no `anon`/`authenticated` table CRUD, no public application-function grants or security-definer functions; no runtime mutation grants on audited append-only stores queried. RLS was not FORCE-enabled; table owners can bypass it, so runtime login matters. `sti_vio_log_app` is a non-superuser/non-bypass/non-creator login and member of non-login `sti_vio_log_runtime`; **the actual Render login and TLS mode were unavailable**. Broad runtime RLS permits server operations; row ownership is enforced primarily by application SQL/middleware, not Supabase per-student identity.

`pg.Pool` defaults to max 10 on the long-lived API, or 1 when `VERCEL` is set; idle timeout 30s, connection timeout 10s, statement timeout 15s. `DB_SSL` defaults to disable, so production must explicitly require verified TLS; `no-verify` is rejected in production. Do not describe Render as a Vercel serverless process. Provider transaction/session pooler configuration and live certificate validation were not inspected.

Migration 036 defines `cleanup_ephemeral_data()` for expired OTP/reset/MFA/step-up/session/throttle and old registration material, leaving official disciplinary records intact. It schedules `0 18 * * *` through `pg_cron` only for public-schema deployments (02:00 Manila if cron timezone is UTC). The extension was observed; actual cron schedule, timezone and execution history were not inspected. [Backup recovery](DATABASE-BACKUP-RECOVERY.md) describes encrypted tooling; provider backups, PITR, retention and successful restores remain unverified.

## Quality and development tools

Node built-in test runner/assert, Vite/React SSR helpers, ESLint 10 and React hooks rules, npm audit, asset budgets, guarded PostgreSQL suites, production readiness/database invariants, Git/GitHub and repository VS Code configuration are evidenced. GitHub Actions configures tests/lint/build/budget/audits, PostgreSQL 17 subsets, SBOM, Gitleaks and CodeQL. Current CI status/branch protection was not obtained. Dependabot is configured for npm and Actions updates. Local Vercel CLI 59.18.0 was used for read-only project/deployment/name-presence evidence; it is an audit tool, not a project dependency. No coverage percentage or comprehensive E2E/load/accessibility report was found.

## Version inventory

The following tables are generated from both manifests/lockfiles and installed package manifests. Installed and locked versions agree at the audit date except where the table explicitly says otherwise. Exact deployed package versions were not inspected; matching deployed Git SHAs do not prove byte-for-byte dependency installation, especially with Vercel's observed `npm install` command.

### frontend direct dependencies

| Package | Manifest range | Locked | Installed | Source use / scope |
|---|---|---|---|---|
| `@vercel/analytics` | `^2.0.1` | 2.0.1 | 2.0.1 | Installed, inactive |
| `html5-qrcode` | `^2.3.8` | 2.3.8 | 2.3.8 | `frontend/src/App.jsx` |
| `qrcode` | `^1.5.4` | 1.5.4 | 1.5.4 | `frontend/src/components/StudentQr.jsx` |
| `react` | `^19.2.8` | 19.2.8 | 19.2.8 | `frontend/src/App.jsx`; `frontend/src/components/AccountSecuritySettings.jsx`; `frontend/src/components/AdminAccountSettings.jsx` |
| `react-dom` | `^19.2.8` | 19.2.8 | 19.2.8 | `frontend/src/App.jsx`; `frontend/src/components/Modal.jsx`; `frontend/src/components/StudentAccountActions.jsx` |
| `socket.io-client` | `^4.8.1` | 4.8.1 | 4.8.1 | `frontend/src/lib/realtime.js` |
| `@eslint/js` | `^10.0.1` | 10.0.1 | 10.0.1 | Build/lint/types development tooling |
| `@types/react` | `^19.2.17` | 19.2.18 | 19.2.18 | Build/lint/types development tooling |
| `@types/react-dom` | `^19.2.3` | 19.2.4 | 19.2.4 | Build/lint/types development tooling |
| `@vitejs/plugin-react` | `^6.0.4` | 6.0.5 | 6.0.5 | Build/lint/types development tooling |
| `eslint` | `^10.11.0` | 10.11.0 | 10.11.0 | Build/lint/types development tooling |
| `eslint-plugin-react-hooks` | `^7.1.1` | 7.1.1 | 7.1.1 | Build/lint/types development tooling |
| `globals` | `^16.4.0` | 16.4.0 | 16.4.0 | Build/lint/types development tooling |
| `vite` | `^8.2.0` | 8.2.1 | 8.2.1 | Build/lint/types development tooling |

### frontend selected relevant transitive resolutions

| Package | Locked version | Relevance |
|---|---|---|
| `rolldown` | 1.2.4 | Vite bundler dependency. |
| `engine.io-client` | 6.6.6 | Socket.IO client transport dependency. |
| `ws` | 8.21.3 | Engine.IO client WebSocket dependency; production transport is configured for polling. |

### backend direct dependencies

| Package | Manifest range | Locked | Installed | Source use / scope |
|---|---|---|---|---|
| `bcrypt` | `^6.0.0` | 6.0.0 | 6.0.0 | `backend/src/controllers/authController.js`; `backend/src/controllers/studentController.js`; `backend/src/services/accountAdministrationService.js` |
| `cors` | `^2.8.6` | 2.8.6 | 2.8.6 | `backend/src/server.js` |
| `dotenv` | `^17.4.2` | 17.4.2 | 17.4.2 | `backend/src/config/database.js`; `backend/src/server.js` |
| `exceljs` | `^4.4.0` | 4.4.0 | 4.4.0 | `backend/src/controllers/reportController.js`; `backend/src/services/auditExport.js`; `backend/src/services/reportExport.js` |
| `express` | `^5.2.1` | 5.2.1 | 5.2.1 | `backend/src/routes/accountAdministrationRoutes.js`; `backend/src/routes/accountRoutes.js`; `backend/src/routes/auditRoutes.js` |
| `express-rate-limit` | `^8.6.2` | 8.6.2 | 8.6.2 | `backend/src/routes/authRoutes.js`; `backend/src/routes/certificateRoutes.js`; `backend/src/routes/highRiskActionRoutes.js` |
| `google-auth-library` | `^11.0.2` | 11.0.2 | 11.0.2 | `backend/src/services/googleIdentityVerifier.js` |
| `helmet` | `^8.3.0` | 8.3.0 | 8.3.0 | `backend/src/server.js` |
| `jsonwebtoken` | `^9.0.3` | 9.0.3 | 9.0.3 | `backend/src/services/sessionTokenService.js` |
| `nodemailer` | `^10.0.16` | 10.0.16 | 10.0.16 | `backend/src/services/emailService.js` |
| `pdfkit` | `^0.17.2` | 0.17.2 | 0.17.2 | `backend/src/services/clearanceCertificateService.js` |
| `pg` | `^8.23.0` | 8.23.0 | 8.23.0 | `backend/src/config/database.js` |
| `socket.io` | `^4.8.1` | 4.8.1 | 4.8.1 | `backend/src/realtime.js` |

### backend selected relevant transitive resolutions

| Package | Locked version | Relevance |
|---|---|---|
| `uuid` | 11.1.1 | ExcelJS dependency, resolved through the backend override. |
| `pg-pool` | 3.14.0 | pg connection pooling. |
| `pg-protocol` | 1.16.0 | pg wire-protocol implementation. |
| `pg-types` | 2.2.0 | pg result-type parsing. |
| `png-js` | 1.1.0 | PDFKit PNG image support. |
| `jpeg-exif` | 1.1.4 | PDFKit JPEG metadata support. |
| `archiver` | 5.3.2 | ExcelJS archive packaging. |
| `fast-csv` | 4.3.6 | ExcelJS CSV support. |
| `jws` | 4.0.1 | google-auth-library and retained jsonwebtoken signature dependencies. |
| `gaxios` | 7.3.1 | google-auth-library and gcp-metadata HTTP dependency. |
| `engine.io` | 6.6.11 | Socket.IO server transport. |
| `ws` | 8.21.3 | Engine.IO/socket.io-adapter WebSocket dependency. |
| `router` | 2.2.0 | Express routing implementation. |

Backend `uuid` override is declared `^11.1.1`; the table reports actual locked resolutions. Selected transitive entries are not a complete SBOM. Both lockfiles contain the full dependency graph; the audit commands cover those graphs. No dependency versions were changed.


## Environment-name inventory

Names below come from source/configuration references and examples, **not secret values**. Presence in source does not mean configured on a provider. The README/deployment guide groups their purposes. Optional test/development/build flags are included and are not all required at runtime.


`ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_ENABLED`, `ADMIN_BOOTSTRAP_FIRST_NAME`, `ADMIN_BOOTSTRAP_LAST_NAME`, `ADMIN_BOOTSTRAP_PASSWORD`, `ADMIN_BOOTSTRAP_USERNAME`, `API_PROXY_ORIGIN`, `APP_VERSION`, `AUTH_THROTTLE_KEY`, `BACKUP_DIR`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_FILE`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `CERTIFICATE_SIGNING_KEY`, `CSRF_SIGNING_KEY`, `DATABASE_ENVIRONMENT`, `DATABASE_URL`, `DB_CONNECT_TIMEOUT_MS`, `DB_HOST`, `DB_IDLE_TIMEOUT_MS`, `DB_NAME`, `DB_PASSWORD`, `DB_POOL_MAX`, `DB_PORT`, `DB_SCHEMA`, `DB_SSL`, `DB_SSL_CA`, `DB_STATEMENT_TIMEOUT_MS`, `DB_USER`, `DEPLOYMENT_ENV`, `EMAIL_TIMEOUT_MS`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `MAIL_FROM`, `MFA_ENCRYPTION_KEY`, `MFA_RECOVERY_KEY`, `MIGRATION_DATABASE_URL`, `NODE_ENV`, `OTP_HASH_KEY`, `PGDATABASE`, `PGHOST`, `PGPASSWORD`, `PGSSLMODE`, `PORT`, `PRODUCTION_API_ORIGIN`, `PRODUCTION_API_URL`, `PRODUCTION_FRONTEND_URL`, `RENDER_GIT_COMMIT`, `SESSION_HASH_KEY`, `SMTP_HOST`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_TIMEOUT_MS`, `SMTP_USER`, `TEST_DATABASE_URL`, `TRUST_PROXY_HOPS`, `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_TARGET_ENV`, `VITE_API_URL`, `VITE_DEPLOYMENT_ENV`, `VITE_GOOGLE_CLIENT_ID`.
