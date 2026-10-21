# STI Vio-Log Security Remediation Plan

> **Historical remediation plan — reviewed October 10, 2026.** Check each task against current source before implementing: runtime pins are now Node 24/npm 11; Vercel proxy/CSP configuration is `frontend/vercel.mjs`, not the former JSON descriptor; socket reauthorization and bounded signature/avatar parsing now exist. Remaining production/session/image/backup verification is tracked in [the current audit](../AUDIT-REPORT.md). Historical unchecked work is not automatically absent code.


This plan corresponds to the source-only audit dated 2026-09-24. P1 tasks are required before real student data or school handover. No source change should be treated as verified until its negative and positive regression cases run in an isolated environment.

## CodeQL triage — October 21, 2026

The main-branch analysis at commit `b9552bb6e2d046979ba5d3a8bda69c9bc40c72c7` reported 14 open alerts. This focused review follows their SARIF data flows; it does not replace the broader audit below.

| Alerts | Assessment and remediation |
| --- | --- |
| #18 | The email regex has overlapping repetitions on request-controlled input. Replace it with linear string checks, reject inputs over the database's 255-character limit, and retain the existing address acceptance rules within that limit. |
| #5, #12, #13 | The department-head updater constructs SQL using the length of a bound-values array. The trace follows the request ID through that array's length, not through raw SQL text, so this is not evidence of injectable SQL. However, filtering values without renumbering placeholders breaks partial updates. Use one literal SQL statement with bound presence/value pairs. The other two alerts are the same query forwarded by test clock wrappers; fix the shared controller rather than suppressing those wrappers. |
| #11, #19 | Test hostname expressions contain unescaped dots. Check bundled SVG URLs against the exact SVG namespace and escape literal dots in the public-policy URL assertion. |
| #8, #20 | Negative URL-substring assertions in tests are not production URL authorization. Replace them with a complete metadata-shape assertion and an exact list of extracted email links. |
| #9, #10, #14 | Remove identity replacements. Monitoring labels need literal substring assertions, not a dynamically constructed regex; date formatting needs no replacement of ` at ` with itself. |

### Findings retained as false positives

- **#4 — CSRF token mistaken for password data.** SARIF starts at frontend `changePassword()` calls and ends at `sessionStorage.setItem(CSRF_KEY, csrf_token)` in `frontend/src/lib/session.js`. The password-change controller returns a public user and a newly generated CSRF token; it does not return the submitted password or password hash. Authentication is carried by the `sti_session` HttpOnly cookie, while this JavaScript-readable token is used as the CSRF request header. The backend requires a matching CSRF cookie/header and the session's stored token hash. Keep this behavior, and test that top-level/user passwords, password hashes and authentication tokens are excluded from persisted session data and legacy localStorage tokens are removed.
- **#15 and #16 — isolated test HTTP servers.** `backend/tests/audit-api.test.js` and `backend/tests/report-excel.test.js` create loopback-only Express servers with stubbed database queries to exercise export authentication and permissions. They intentionally do not mount the production application's global rate limiter. In `backend/src/server.js`, `app.use(apiLimiter)` precedes the report and audit mounts and limits requests to 200 per 15 minutes. The test-only route definitions do not establish a missing production limiter; keep their permission checks and the production limiter unchanged.

No alerts are dismissed on GitHub, no queries are disabled, and tests remain included in CodeQL analysis. A subsequent scan of the changed commit must establish which alerts close; #4, #15 and #16 may remain visible with the above explanations. Test execution evidence is recorded separately from scan status: passing regressions do not prove that GitHub has rescanned the fixes.

Local verification on Node 24.18.1: 341 backend tests, 470 frontend tests and 31 lifecycle/attendance PostgreSQL integration tests passed; frontend lint and production build passed. Tests used a temporary source copy without private environment files, an allowlisted dummy environment and a newly initialized loopback PostgreSQL database. The email-limit and partial-update regressions failed against the original code before passing with the fixes. A source-only independent review found no actionable issues. The build retains its existing large-chunk warning; GitHub CodeQL results for these changes remain unverified.

## P0 — Block Deployment

No independently confirmed critical/high vulnerability was established. Deployment remains blocked by incomplete audit coverage rather than a P0 code finding.

## P1 — Required Before Real Student Data

### P1-1 — Complete the full audit in an enforceable Linux sandbox

- Affected: entire repository and audit pipeline.
- Change: provision a disposable Linux VM/container runner with read-only target/toolchain, `env -i` allowlist, no external network, loopback-only fixtures, non-root UID, scratch-only writes, CPU/memory/process/file/disk/time limits, and trusted no-follow artifact promotion.
- Expected behavior: both audit validators pass; every coverage unit is hunted; each candidate is independently validated and final-verified.
- Tests: backend/frontend unit suites; focused auth/RBAC/CSRF/MFA/OTP/QR/concurrency/signature/certificate/realtime tests; disposable PostgreSQL integration tests.
- Dependencies: Linux runner and disposable database; locally cached dependencies or prebuilt read-only toolchain.
- Risk: low application risk; medium setup effort.
- Deployment: never connect the runner to production identities, data, or providers.

### P1-2 — Revalidate Socket.IO authority after security changes

- Affected: `backend/src/realtime.js`, account/session/role/department mutation services.
- Change: track sockets by user/session and disconnect or recompute room membership after revocation, deactivation, password change, role change, department transfer, or assignment end. Consider periodic/current-session checks before sensitive emissions.
- Expected behavior: a stale socket receives no prior-role/prior-department event after authority changes.
- Tests: authorized connection succeeds; revocation/role transfer causes disconnect or room removal; unrelated user remains connected.
- Dependencies: event hooks from account/assignment services.
- Risk: medium; careless room updates can suppress legitimate notifications.
- Deployment: roll out with connection/disconnect metrics and client reconnect testing.

### P1-3 — Validate decoded e-signature images

- Affected: `backend/src/services/clearanceCertificateService.js`, signature tests.
- Change: verify PNG/JPEG magic bytes and decode with a bounded image decoder before storage; reject SVG/HTML/polyglots, malformed/truncated files, excessive dimensions/pixels, and trailing unexpected data according to a documented policy. Strip metadata by re-encoding when feasible.
- Expected behavior: only valid bounded PNG/JPEG image pixels reach storage/PDFKit.
- Tests: authorized valid PNG/JPEG succeeds; mislabeled text, malformed Base64, truncated image, SVG, polyglot, oversized bytes/dimensions fail; historical certificate snapshots remain unchanged.
- Dependencies: carefully selected/pinned decoder or a narrow internal verifier.
- Risk: medium; existing malformed signatures may require cleanup.
- Deployment: inventory current signatures first; do not overwrite historical certificate snapshots.

### P1-4 — Prove Supabase/PostgreSQL least privilege

- Affected: migrations 034–039, production DB roles/grants/RLS/functions/sequences, deployment secrets.
- Change: run the repository security check with owner-reviewed SQL; prove runtime login is non-owner, non-superuser, non-BYPASSRLS, non-CREATEDB/CREATEROLE; revoke PUBLIC/anon/authenticated access not explicitly required; restrict exposed schemas/Data API; separate migration/runtime credentials.
- Expected behavior: only Express runtime can perform intended CRUD; audit rows cannot be altered by runtime; direct anon/authenticated reads fail.
- Tests: role capability matrix and unauthorized/authorized SQL cases in a cloned isolated DB.
- Dependencies: Supabase owner and disposable clone.
- Risk: high migration risk if grants are tightened without route coverage.
- Deployment: backup first; apply and smoke-test in staging before production.

### P1-5 — Verify proxy, preview, cookie, CORS, and rate-limit behavior

- Affected: `frontend/vercel.json`, `backend/src/server.js`, `backend/src/config/security.js`, provider settings.
- Change: document exact Vercel→Render hop chain and set `TRUST_PROXY_HOPS` explicitly; prevent client forwarding headers from controlling `req.ip`; isolate previews from production backend/secrets; confirm WebSocket upgrades and same-origin cookies.
- Expected behavior: attacker Origin rejected; forged forwarding headers do not change rate identity; preview cannot access production; Secure/SameSite/HttpOnly cookies behave as intended.
- Tests: low-volume owner-observed header/cookie checks with owned test accounts plus isolated proxy fixture.
- Dependencies: Vercel/Render administrators.
- Risk: high availability/authentication risk if proxy hops are wrong.
- Deployment: change with logs, rollback plan, and controlled test window.

### P1-6 — Execute CI security gates and triage results

- Affected: `.github/workflows/security.yml`, both lockfiles.
- Change: require successful backend/frontend tests, lint/build, `npm audit`, SBOM, Gitleaks full history, and CodeQL on protected branches; review every advisory for reachable production impact.
- Expected behavior: merges cannot bypass required security checks and no secret is reported.
- Tests: branch-protection screenshot/export, successful run links, retained SBOMs, documented false-positive process.
- Dependencies: GitHub administration and registry access.
- Risk: low; may surface upgrade work.
- Deployment: pin all new actions by immutable SHA.

### P1-7 — Protect backups and remove plaintext operational copies

- Affected: `backend/scripts/backup.js`, `docs/DATABASE-BACKUP-RECOVERY.md`, operator storage. Specific local backup observations are retained privately; contents were not opened.
- Change: prohibit plaintext SQL dumps in repository/OneDrive workspaces; use encrypted destination, restricted ACL, retention policy, integrity check, and isolated restore drill.
- Expected behavior: backups are encrypted at rest, access logged/restricted, and restorability demonstrated.
- Tests: restore a non-production backup into an isolated DB and verify integrity/access denial.
- Dependencies: school retention policy and secure storage.
- Risk: high data-loss/privacy impact if mishandled.
- Deployment: securely relocate/delete plaintext copies only after owner review and confirmed encrypted replacement.

## P2 — Production Hardening

### P2-1 — Minimize public certificate data

- Affected: `backend/src/controllers/clearanceCertificateController.js:314-326`.
- Change: obtain a written privacy decision for full name/program/hours; return only fields required for authenticity; add dedicated public-verification throttling and monitoring.
- Tests: valid code returns approved minimum; invalid/random codes are generic; revoked certificate is clearly invalid.
- Risk: low-to-medium product/privacy tradeoff.

### P2-2 — Narrow browser policy

- Affected: `frontend/vercel.json`, `frontend/vite.config.js`.
- Change: replace broad `connect-src https: wss:` with exact production API/socket/Google hosts; evaluate nonce/hash-based styles to reduce `'unsafe-inline'`; maintain Google and QR functionality.
- Tests: CSP report-only trial, Google login, Socket.IO, camera scanner, downloads, and all routes.
- Risk: medium UI/integration breakage.

### P2-3 — Pin supported runtimes

- Affected: backend/frontend `package.json`, deployment configuration.
- Change: declare Node/npm versions matching CI and provider runtimes; establish patch cadence.
- Tests: clean locked install/build/test in the chosen runtime.
- Risk: low.

### P2-4 — Expand negative authorization automation

- Affected: backend tests for every ID-bearing route.
- Change: build a two-student/two-department matrix proving unauthorized action rejected and authorized action succeeds, including lists, exports, messages, signatures, certificates, notifications, and guardian records.
- Risk: low; test-only until defects are found.

## P3 — Long-Term Security Operations

- Quarterly privileged-account and role review, including the merged DISCIPLINE_ADMIN blast radius.
- Scheduled key rotation and emergency revocation exercises for session/CSRF/OTP/MFA/certificate/backup/provider keys.
- Quarterly backup restore drill with recorded RTO/RPO and integrity evidence.
- Centralized security-event monitoring for auth failures, step-up actions, exports, certificate/signature changes, and role/department transitions.
- Written incident-response contacts, notification thresholds, evidence preservation, breach escalation, and student-data retention/deletion policy.
- Annual independent application and cloud configuration review before each academic year.


> Current academic support: College and SHS ABM/STEM are described in the [student academic model](../STUDENT-ACADEMIC-MODEL.md). This document retains its historical findings or design context; it does not override current account-provisioning or authorization behavior.
