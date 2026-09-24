# STI Vio-Log Security Audit

Audit date: 2026-09-24  
Source: commit `0aec1876aaba50f7796002ff43546ab14a4c2d0a` (clean at audit start)  
Profile: standard, full repository scope  
Status: **INCOMPLETE — source-only security assessment**

## Executive Summary

The repository shows substantially better security engineering than a typical capstone: opaque server-side sessions, per-request account and permission refresh, CSRF binding, mandatory administrator MFA, transaction/locking controls, parameterized SQL, centralized permissions, restricted database-role migrations, SHA-pinned CI actions, and dedicated negative security tests are all present.

However, this review cannot give a production-ready PASS. The mandatory audit validators refuse input on Windows because protected no-follow file opening is unavailable; WSL is not installed. The environment also cannot enforce the audit skill's complete execution sandbox (read-only target/toolchain, empty environment, isolated network, scratch-only writes, full resource limits, and race-safe artifact promotion). Therefore no target-controlled test, build, dependency audit, local server, or database test was executed. Fourteen planned coverage units were deferred before hunting, so no candidate received the required independent validation. There are **zero confirmed vulnerabilities**, but that does not mean zero vulnerabilities.

Before real student data or school handover, STI should require a controlled Linux audit runner, a disposable PostgreSQL test environment, and owner-verified Vercel/Render/Supabase settings. Five source-grounded leads deserve priority: stale Socket.IO room authorization, signature-file content validation, proxy-hop trust, production database least privilege/Data API exposure, and preview-to-production isolation.

## Architecture / Trust Boundaries

`Browser → Vercel SPA/rewrite → Render/Express + Socket.IO → Supabase PostgreSQL`

Additional boundaries are Google identity → backend verification; backend → Brevo/SMTP; backend → generated PDF/email; GitHub Actions → build/security artifacts; and operator CLI → migrations/backups/bootstrap.

Principals are unauthenticated visitors, STUDENT, department-scoped DEPARTMENT_HEAD, DISCIPLINE_OFFICE, merged DISCIPLINE_ADMIN, browser code, backend workload, runtime/migration database identities, CI, and deployment operators. Sensitive resources include credentials, sessions, MFA/OTP state, student/guardian/disciplinary data, messages, attendance and credited hours, certificates, signatures, audit logs, backups, and deployment secrets.

## Existing Security Controls

- Opaque 32-byte session tokens are stored as keyed hashes; cookies are HttpOnly, SameSite=Lax, and Secure in production (`backend/src/services/browserSessionService.js:5-35`).
- Authentication rechecks current session expiry/revocation, active account, role, department, permissions, password-change state, and student onboarding on each HTTP request (`backend/src/middleware/authMiddleware.js:29-114`).
- Mutations require session-bound double-submit CSRF validation; Origin is additionally allowlisted when present (`backend/src/middleware/authMiddleware.js:125-134`, `backend/src/server.js:145-150`).
- DISCIPLINE_ADMIN password login requires TOTP enrollment/verification; recovery codes are hashed and single-use (`backend/src/controllers/authController.js:44-50`, `backend/src/controllers/sessionController.js`).
- High-risk lock/recovery step-up is short-lived, one-use, and bound to actor, action, target, and target session version (`backend/src/services/highRiskActionService.js:31-73`).
- Security configuration fails closed in production for short/reused keys, insecure origins, and unverified database TLS (`backend/src/config/security.js:7-25`).
- Queries reviewed during reconnaissance are parameterized; several workflows use transactions, row locks, advisory locks, uniqueness constraints, and server timestamps.
- CI uses SHA-pinned actions, read-only default permissions, `npm ci --ignore-scripts`, Gitleaks, CodeQL, dependency audits, and SBOM generation (`.github/workflows/security.yml`). These jobs were not observed running in this audit.

## Attack Surface

- Public: password/Google login, MFA challenge/setup completion, student recovery, signed certificate verification, root, health.
- Authenticated: student self-service; violations; attendance/QR; community service; clearance/certificates/signatures; messaging; notifications; reports/exports; guardian contact; account/department/officer management; audit/security telemetry; high-risk actions.
- Realtime: cookie-authenticated Socket.IO, server-to-client invalidation events, user/role/department rooms.
- File/data: Base64 signature images, PDF/CSV/XLSX generation, certificate email attachments, migration SQL, encrypted backups.
- Operational: environment variables, Vercel rewrites/headers, Render service settings, Supabase roles/RLS/Data API, GitHub Actions, npm dependencies.

## Endpoint Authorization Matrix

This is a route-group matrix; controller-level object scope remains part of the required validation.

| Route group | Authentication | Role/permission | Object scope | CSRF on mutations | Audit/rate control |
|---|---|---|---|---|---|
| `/api/login`, Google, MFA, student recovery | Public/preauth | Flow-specific | Account/challenge binding | Not cookie-authenticated | Sensitive auth limiter |
| `/api/auth/session`, `/csrf`, `/logout` | Session | Current user | Current session | Yes for logout | Global limiter |
| `/api/students` | Session | Admin/office/student plus route guards | Student-self paths use `req.user.id`; staff routes require review | Yes | Administrative audit mount |
| `/api/violations` | Session | Per-operation permissions | Student/object/department logic in controllers | Yes | Administrative audit mount |
| `/api/community-service`, `/api/qr` | Session | Assignment/scan/correction permissions | Active officer department + assignment/state checks | Yes | Administrative audit mount |
| `/api/clearance` | Session | Clearance/certificate/signature permissions | Student/certificate/signature IDs | Yes | Administrative audit mount |
| `/api/student/clearance` | Session | STUDENT | Queries bind to `req.user.id` | Yes when applicable | Global limiter |
| `/api/certificates/clearance/:code` | Public bearer code | HMAC-authenticated code | Exact certificate ID | N/A | Global limiter only |
| `/api/messages` | Session | Private-message permission | Student conversations bind via student user ID | Yes | Administrative audit mount |
| `/api/reports` | Session per route | Report/export or department-report permission | Controller filters; needs exhaustive verification | GET only | Export routes audited |
| `/api/admin/*`, `/api/system`, `/api/high-risk-actions` | Session | Admin permissions/role | Target IDs; high-risk target/action binding | Yes | Administrative audit + step-up where required |
| Socket.IO | Session cookie at handshake | Current role/department at connect | Static rooms after connection | Origin allowlist, no app inbound events | 100 KB transport bound |

## Findings Summary

No record met the audit skill's confirmation bar because safe local execution and independent candidate/final verification could not run.

| ID | Severity | Component | Finding | Status |
|---|---|---|---|---|
| NV-01 | Not assigned | Socket.IO | Existing sockets may retain role/department rooms after session or account changes | NEEDS VALIDATION |
| NV-02 | Not assigned | E-signatures | Backend validates Base64 label/size but not image magic bytes or decodeability | NEEDS VALIDATION |
| NV-03 | Not assigned | Proxy/rate limiting | Correctness depends on the unverified `TRUST_PROXY_HOPS` deployment value | NEEDS VALIDATION |
| NV-04 | Not assigned | PostgreSQL/Supabase | Restricted runtime role and Data API isolation are migration intent, not observed production fact | NEEDS VALIDATION |
| NV-05 | Not assigned | Vercel/Render | Preview deployments may share the hardcoded production backend unless provider policy prevents it | NEEDS VALIDATION |

## Detailed Findings

### NV-01 — Socket authorization is captured only at connection time

`backend/src/realtime.js:21-55` validates the session and joins user/role/department rooms once. There is no disconnect or room-reconciliation hook shown for deactivation, role change, department transfer, or session revocation. Subsequent role/department emissions occur at `backend/src/realtime.js:60-62`. Because events mostly contain IDs and trigger authenticated HTTP refetches, impact may be limited, but a stale client could still receive event metadata after losing authority. Validate with two dummy users in an isolated loopback fixture: connect, revoke/change authority in the fake database, emit to the prior room, and confirm the old socket is disconnected or receives nothing.

### NV-02 — Signature uploads do not verify actual image content

`backend/src/services/clearanceCertificateService.js:77-82` checks the data-URL MIME label, Base64 alphabet, and decoded length, but does not check PNG/JPEG magic bytes or decode the image. Bytes are stored and later passed to PDFKit (`backend/src/controllers/clearanceCertificateController.js:166-170,228-241`). In a sandbox, submit tiny mislabeled/malformed fixtures and verify rejection occurs before storage and PDF generation without process instability.

### NV-03 — Proxy trust is deployment-sensitive

`backend/src/server.js:50` defaults production trust proxy to one hop. Client IP drives rate limiting, audit/security events, and HTTPS interpretation. The correct hop count and Render/Vercel header normalization are not in the repository. The owner should document the exact proxy chain and verify, with provider-observed requests using owned test accounts, that client-supplied forwarding headers cannot select `req.ip` or bypass throttles.

### NV-04 — Database least privilege is not established in production

Migration 034 creates a restricted runtime group, revokes Supabase `anon`/`authenticated` access, enables RLS, and grants application-table access. Application-level authorization remains the final user boundary because runtime RLS policies are broad. Production must prove the login role is a member only of the intended runtime role, is not owner/superuser/BYPASSRLS/CREATEDB/CREATEROLE, migrations 034–039 are applied, protected schemas are not exposed through PostgREST/Data API, and PUBLIC/function/sequence grants are restricted.

### NV-05 — Preview isolation is provider-dependent

`frontend/vercel.json:3-5` hardcodes both `/api` and `/socket.io` to the production Render hostname. Whether preview deployments are public and whether they may access production depends on Vercel/Render settings not stored here. Before handover, preview builds must use a separate non-production backend or be access-controlled and prevented from carrying production secrets/cookies.

## Authentication Assessment

Source posture is strong but runtime is unverified. Password errors are generic, bcrypt is used, auth throttling is account/IP keyed, administrator MFA is mandatory, Google ID tokens are audience-verified through the official library, and reset flows use hashed/expiring state with transactional locking. Required validation includes timing/enumeration, concurrent OTP/reset use, alternate-path MFA bypass, Google provider configuration, live key separation, and session invalidation across all channels.

## Authorization/RBAC Assessment

Roles and permissions are centralized. DISCIPLINE_ADMIN intentionally combines operational and technical authority, creating a large blast radius even where implementation is correct. Keep the merged role if required by policy, but use named accounts, mandatory MFA, short idle sessions, step-up for destructive actions, alerts, and periodic access review. Every `:id` route still needs isolated two-principal negative tests; source presence of middleware is not proof of object-level protection.

## Database/Supabase Assessment

Migrations show thoughtful hardening, search-path work, session-revocation triggers, and restricted role intent. Deployment role membership, actual grants/RLS, Data API exposure, TLS CA verification, backup policy, and migration state are NOT VERIFIED.

## Frontend Assessment

No `dangerouslySetInnerHTML` or direct DOM HTML sink was found during reconnaissance; React text rendering is the dominant path. Legacy bearer tokens are removed, while a minimal user cache remains in localStorage and CSRF state in sessionStorage. CSP exists, but `connect-src https: wss:` and inline styles are broad hardening opportunities, not confirmed vulnerabilities. Browser behavior, Google compatibility, production sourcemaps, and effective deployed headers are NOT VERIFIED.

## Infrastructure Assessment

The repository has Vercel headers/rewrites but no Render manifest and no provider/IAM exports. TLS, DNS, preview scope, proxy headers, egress, secrets, process command, runtime patching, and provider logs require owner evidence.

## Business-Logic Assessment

Source shows transactions and locks around several certificate, attendance, registration, reset, and escalation paths. Dynamic tests for duplicate time-in/out, concurrent scans, stale department assignment, certificate eligibility/revocation, duplicate issuance, and clearance TOCTOU were blocked by the missing sandbox and disposable database.

## Privacy Assessment

Public certificate verification returns full student name, masked student number, program, and completed hours (`backend/src/controllers/clearanceCertificateController.js:314-326`). The code is an HMAC bearer value and is not predictably enumerable without the key, but STI must document that this disclosure is necessary and obtain a privacy-policy decision. An ignored 43 KB `sti_vio_log_backup.sql` exists in the local/OneDrive workspace; its contents were not opened. Future backups must never be left unencrypted in synchronized folders.

## CI/CD Assessment

Workflow actions are immutable-SHA pinned and permissions are narrow. Gitleaks/CodeQL/audit/SBOM steps exist. Current GitHub branch protection, required checks, secret scanning/push protection, fork approval policy, artifact visibility, and last successful workflow results are NOT VERIFIED. Local Gitleaks was unavailable and no registry-backed `npm audit` was run.

## Dependency Assessment

Both lockfiles exist. No vulnerability verdict is provided: installed dependency reachability and current advisory data were not safely obtainable offline. Run the pinned CI audits/SBOM generation and triage advisories for production reachability before handover.

## Production Readiness

**Decision: NOT READY FOR REAL STUDENT DATA OR FORMAL SCHOOL HANDOVER YET.** This is driven by incomplete independent testing and unverified production controls, not by a confirmed critical vulnerability. Complete the P1 plan, then rerun the full audit on Linux with disposable infrastructure.

## Unverified Items

- All dynamic authentication, authorization, CSRF, concurrency, file, PDF, QR, and Socket.IO regression tests.
- `npm audit`, SBOM results, Gitleaks history scan, CodeQL results, and CI pass status.
- Vercel, Render, Google, Brevo, Supabase, DNS/TLS, proxy, preview, IAM, logs, and secret scopes.
- Production database roles/grants/RLS/migrations/Data API exposure and backup/restore evidence.
- Incident response contacts, retention/legal-hold policy, restore drill, key rotation, and access-review records.

## Security Scorecard

| Domain | Status |
|---|---|
| Authentication | PARTIAL |
| MFA | PARTIAL |
| Session Security | PARTIAL |
| Authorization/RBAC | PARTIAL |
| IDOR/BOLA | NOT VERIFIED |
| CSRF | PARTIAL |
| Input Validation | PARTIAL |
| SQL Injection | PARTIAL |
| XSS | PARTIAL |
| Database | NOT VERIFIED |
| Supabase | NOT VERIFIED |
| Google Auth | PARTIAL |
| Brevo | PARTIAL |
| QR Security | NOT VERIFIED |
| Community Service | NOT VERIFIED |
| Clearance | NOT VERIFIED |
| Certificates | PARTIAL |
| E-signatures | PARTIAL |
| Socket.IO | PARTIAL |
| Secrets | NOT VERIFIED |
| CI/CD | PARTIAL |
| Vercel | PARTIAL |
| Render | NOT VERIFIED |
| Backup/Recovery | NOT VERIFIED |
| Logging/Audit | PARTIAL |

## BLOCKERS

- No confirmed blocker was established. The production gate is nevertheless blocked by incomplete coverage, unavailable dynamic/independent validation, and unverified production database/deployment controls.
- Do not handle real student data until the Linux isolated audit and the P1 owner validations are complete.

## REQUIRED BEFORE HANDOVER

- Complete isolated authorization, concurrency, QR, certificate, signature, session, CSRF, MFA, OTP, and Socket.IO tests.
- Prove Supabase runtime least privilege, applied migrations, Data API isolation, TLS, encrypted backups, and successful restore testing.
- Prove Vercel/Render proxy, preview, cookie, CORS, rate-limit, WebSocket, secret, logging, and deployment settings.
- Resolve NV-01 through NV-05 and attach CI/Gitleaks/CodeQL/npm-audit evidence.

## RECOMMENDED HARDENING

- Add realtime disconnect/reconciliation on security state changes, content-decode signature validation, narrower CSP destinations, explicit Node/npm versions, documented proxy topology, and encrypted backup enforcement.
- Separate preview/staging resources from production and establish periodic access, key-rotation, restore, and incident-response exercises.

## VERIFIED CONTROLS

- Verified by source inspection only: opaque HMAC-hashed sessions; per-request current identity/permission lookup; CSRF binding; administrator MFA path; bound one-use admin step-up; production key/TLS config validation; centralized permission mapping; transaction/lock use in sensitive workflows; SHA-pinned CI actions and narrow workflow permissions.
- No runtime control received a PASS in this audit.
