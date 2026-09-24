# STI Vio-Log Security Remediation Plan

This plan corresponds to the source-only audit dated 2026-09-24. P1 tasks are required before real student data or school handover. No source change should be treated as verified until its negative and positive regression cases run in an isolated environment.

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

- Affected: `backend/scripts/backup.js`, `docs/DATABASE-BACKUP-RECOVERY.md`, operator storage. A local ignored `sti_vio_log_backup.sql` was observed but not opened.
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
