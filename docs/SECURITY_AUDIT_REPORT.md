# STI Vio-Log Security Audit Report

**Audit date:** 10 November 2026 (Asia/Manila)  
**Source ref:** `fc1c319` (`main`) plus local remediations listed in section J (not committed)  
**Working tree:** unrelated local deletions of frontend image assets were **not** reviewed as security changes  
**Profile:** source-and-local; no authenticated production probing; no student production data  
**Standards used as assessment references:** OWASP Top 10 (2021), OWASP API Top 10, ASVS session/auth guidance, CWE Top 25. This report is **not** a certification.

**Execution limits:** Windows cannot enforce the audit skill’s no-follow sandbox. Confirmation used source traces plus existing Node unit tests. PostgreSQL integration tests and Gitleaks were **not** executed in this pass (no disposable DB attached; Gitleaks binary not installed). Local `.env` files exist and are gitignored; their values were **not** copied into this document.

---

## A. Executive Summary

STI Vio-Log’s source implements a stronger control set than a typical school capstone: **opaque hashed browser sessions** (not production JWT), per-request identity refresh, CSRF double-submit, parameterized SQL, permission catalogs, department-scoped community service, Google login restricted to linked **STUDENT** rows, MFA for `DISCIPLINE_ADMIN`, OTP attempt/resend limits, Helmet/CORS/HTTPS fail-closed production config, Vercel same-origin API proxy, and RLS enablement in migrations.

This pass **did not confirm a Critical or High vulnerability** with a demonstrated cross-boundary exploit in source plus local tests. It **did confirm** a Medium authorization-defense gap (route-level role gates missing on some `/api/account` handlers) and a Low information leak (hardcoded LAN address in API startup logs). Both were remediated in this engagement (section J).

The system is **not ready for institutional handover** solely from this review: live Supabase RLS/grants, Render TLS/`TRUST_PROXY_HOPS`, Vercel preview isolation, backups, Cloudflare (not verified), and Terms enforcement (`enforcementEnabled: false`) remain owner-validated.

**Verdict: CONDITIONALLY READY** for continued production operation of the existing deployment, **not** for treating this document as a penetration-test clearance or school handover pack.

---

## B. System Architecture

Verified from repository (not assumed from the original brief):

```
Browser → Vercel SPA + same-origin rewrites (/api/*, /socket.io/*)
       → Render Express + Socket.IO (HTTP polling in production)
       → Supabase PostgreSQL (pg driver; no browser Supabase SDK)
```

| Component | Actual implementation |
|---|---|
| Frontend | React 19 + Vite 8 on Vercel; production `API_URL` is same-origin (`frontend/src/lib/api.js`) |
| Backend | Node.js Express on Render; bind `0.0.0.0:$PORT` |
| Auth | Cookie `sti_session` (HttpOnly, SameSite=Lax, Secure in production); HMAC-SHA256 stored hash; 8h absolute; idle 30 min admin / 120 min others. **Production Bearer JWT issuance is disabled.** |
| Google | GIS ID token verified server-side; login joins `google_identity_links` **and** `students` with `role='STUDENT'` |
| Email | Brevo HTTPS API (SMTP fallback for local) |
| Realtime | Socket.IO cookie handshake; rooms user/role/department; 15s reauthorization |
| Roles | `DISCIPLINE_ADMIN`, `DISCIPLINE_OFFICE`, `DEPARTMENT_HEAD`, `STUDENT`. `ADMIN` / `SYSTEM_ADMIN` are **not** portal roles |

---

## C. Security Audit Coverage

### Audited

- Route mounts in `backend/src/server.js`
- `authMiddleware.js`, `permissions.js`, `rateLimiters.js`, `browserSessionService.js`, `sessionTokenService.js`, `otpService.js`, `googleIdentityService.js`, `legalPolicyService.js`, `realtime.js`
- Account, message, notification, parent-contact, QR, community-service, violation, student, report, clearance/certificate, audit, system, high-risk routes
- Avatar/signature parsers, certificate HMAC codes
- Frontend `api.js` (credentials, CSRF, 401 handling), `vercel.mjs` CSP/proxy, `legalPolicies.mjs`
- CI `.github/workflows/security.yml` (Gitleaks, CodeQL, npm audit, disposable Postgres gate)
- `.gitignore` / tracked env examples only
- Prior NV-01–NV-05 vs current source
- Local tests: 80 security-focused backend tests (see H); frontend suite previously 562/562 on `fc1c319`; `npm audit --omit=dev` 0 high+ (backend and frontend)

### Not executed / out of scope this pass

- Authenticated production API or student-record access
- Destructive load/DDoS/brute-force
- Gitleaks/TruffleHog/ZAP/Burp/CodeQL live run (CI defines them)
- Live Supabase dashboard, Render env values, Cloudflare DNS
- pgtests against any database URL (avoid production `DATABASE_URL`)

---

## D. Vulnerability Findings

Severity is assigned **only** to confirmed records.

### Confirmed

#### C-01 — Account self-service lacked route-level role gates (MEDIUM)

- **Status:** Confirmed; **remediated** (section J)
- **CWE:** CWE-863 / API broken function-level authorization (defense in depth)
- **Affected:** `backend/src/routes/accountRoutes.js` (pre-fix: onboarding and `/admin-profile` relied on controllers only)
- **Explanation:** `/api/account` is authenticated for all portal roles. Student onboarding and administrator profile handlers previously depended on controller `role` checks. Controllers already returned 403 (`ADMIN_REQUIRED` / `Student account required`), so **privilege escalation was not demonstrated**. A staff client could still invoke student-onboarding URLs (and vice versa) until the controller ran.
- **Impact:** Extra attack surface and inconsistent 403 vs route denial; not a working admin takeover.
- **Fix:** `requireExactRoles` (role match without onboarding/password gates) on those routes. Password-change remains ungated by role so forced-change users can proceed.

#### C-02 — Hardcoded LAN address in API startup logs (LOW)

- **Status:** Confirmed; **remediated**
- **CWE:** CWE-200
- **Affected:** `backend/src/server.js` (former `192.168.100.81` log line)
- **Explanation:** Production process logs advertised a private lab IP. That does not grant access by itself but leaks internal addressing to anyone who can read Render logs.
- **Fix:** Structured listen log with bind and port only.

### Needs validation (no severity)

| ID | Topic | Missing fact |
|---|---|---|
| NV-01 (prior) | Socket live revocation under load | Source now reauthorizes every 15s and on emit (`backend/src/realtime.js`); **tests pass**. Owner should still confirm a revoked session disconnects a live production tab. |
| NV-02 (prior) | Signature/avatar decode | Magic bytes, IHDR/IEND, JPEG SOI/EOI, and dimension caps exist and are unit-tested. Full re-encode/sanitize of pixel payloads is still unverified. |
| NV-03 | `TRUST_PROXY_HOPS` | Production startup **requires** integer 1–3. Correct hop count vs Vercel→Render is an operator measurement. Wrong value would distort `req.ip` rate limits. |
| NV-04 | Live RLS / Data API / runtime role | Migrations enable RLS and grant `sti_vio_log_runtime`. CI `security:database` exists. Production login, bypassrls, and Data API exposure need owner console evidence. |
| NV-05 | Preview isolation | `frontend/vercel.mjs` fails non-production builds that proxy to `PRODUCTION_API_ORIGIN`. Provider env scoping is not visible in git. |
| NV-06 | Backups / PITR / restore drill | Scripts exist (`backend/scripts/backup.js`); restore success not observed here. |
| NV-07 | Cloudflare | Not present in repo. Historical DNS is GoDaddy → Vercel. Do not claim WAF/DDoS beyond Vercel/Render defaults. |
| NV-08 | Legal acknowledgment | `shared/legalPolicies.mjs` `enforcementEnabled: false` (intentional; tests lock this). Portal access is not gated on Terms until the school enables it. |
| NV-09 | Render Free cold starts / single instance | Availability and idle spin-down; not an auth bypass. |
| NV-10 | Local gitignored `.env` | Present on the developer machine. Confirm they are never uploaded; rotate if they were ever shared. |

### Rejected / disproved as current confirmed vulns

- “Cookie JWT in production” — JWT sign is thrown in production (`sessionTokenService.js`).
- “Students can mutate violations via hidden UI” — `/api/violations` uses permission middleware; STUDENT lacks those permissions.
- “Google login for staff” — login query requires `students` + `role='STUDENT'`.
- “NV-01 rooms never refresh” — current source refreshes authorization on an interval and before emit; unit tests cover stale rooms.
- “NV-02 no magic-byte checks” — current parsers reject non-PNG/JPEG structure.

---

## E. Secret and Data Leakage Assessment

| Check | Result |
|---|---|
| Tracked `.env` | Only `backend/.env.example` and `frontend/.env.example` (placeholders) |
| `.gitignore` | Ignores `.env`, `.env.*`, dumps, logs, keys |
| Hardcoded production secrets in source | None found. Development fallbacks exist and are blocked by `validateSecureConfig` when `NODE_ENV=production` |
| `VITE_*` | Google client ID (public by design) and local API URL. No service-role or DB password prefix |
| API responses | Certificate public verify returns name + masked student number only. Staff credential create returns one-time password to authorized officers (intended) |
| Frontend storage | Display user in `localStorage`; session token is **not** stored (cookie). CSRF is a non-HttpOnly cookie (double-submit) |
| Gitleaks this pass | **Not run** (binary absent). CI workflow includes Gitleaks on push/PR |
| This report | No secret values |

If a developer `.env` was ever pasted into chat, tickets, or a public gist, rotate those keys (session, CSRF, OTP, MFA, certificate, DB, Brevo, Google).

---

## F. Authentication and Authorization Assessment

### Authentication

- Opaque 32-byte tokens, HMAC stored, cookie flags as above.
- Logout revokes `browser_sessions` and disconnects sockets.
- Idle and absolute expiry enforced in SQL on each request.
- CSRF: cookie + `X-CSRF-Token` + `csrf_hash` for non-GET authenticated mutations.
- Login limiter: 10 / 15 min; additional throttle service; generic “Invalid username or password”.
- Admin password login requires TOTP enroll/verify; recovery codes hashed, single-use.
- OTP: 6 digits, 10 min, 5 attempts, 60s resend, hashed, used_at on success/supersede.
- Google: ID token verify; email must match staff-recorded pending Gmail for linking; login cannot create staff sessions.

### Roles

| Role | Notable permissions |
|---|---|
| DISCIPLINE_ADMIN | Operational + staff admin + technical (lock, security events, MFA) |
| DISCIPLINE_OFFICE | Operational student/violation/attendance/clearance/messages; **not** staff-account or system lock |
| DEPARTMENT_HEAD | Basic student view, scan/invalidate attendance, department reports; **no** private-message permission, **no** violation create |
| STUDENT | Own records + private messages |

### Endpoint-group matrix (source)

| Group | Authn | Authz | Object scope | CSRF | Notes |
|---|---|---|---|---|---|
| `/api/login`, Google, MFA, student password recovery | Public / preauth cookie | Flow-specific | Challenge-bound | Origin on mutations | Sensitive limiter 10/15m |
| `/api/auth/session`, csrf, logout, legal | Session | Self | Current session | Yes except GET | |
| `/api/account/password-change` | Session | Any authenticated | `req.user.id` | Yes | Intentionally allowed during forced password change |
| `/api/account/student-onboarding/*` | Session | `requireExactRoles('STUDENT')` | `req.user.id` | Yes | Onboarding gate skipped by design |
| `/api/account/admin-profile*` | Session | `requireExactRoles('DISCIPLINE_ADMIN')` | `req.user.id` | Yes | Controller also requires admin profile row |
| `/api/students/me*` | Session | STUDENT | `req.user.id` | PATCH yes | |
| `/api/students` CRUD | Session | Admin/office | Path student IDs | Yes | |
| `/api/violations` | Session | Permissions | Controllers | Yes | Students have no write perms |
| `/api/community-service` | Session | Role+permission | Head scoped by `department_id` | Yes | Day invalidation re-checks assignment department |
| `/api/qr` | Session | ATTENDANCE_SCAN | Head: `requireAuthorizedDepartment` + assignment | Yes | Server `clock_timestamp()` |
| `/api/clearance` | Session | Clearance permissions | Staff | Yes | Students use `/api/student/clearance` |
| `/api/certificates/clearance/:code` | Public HMAC | Code | Certificate id | N/A | Extra 30/15m limiter |
| `/api/messages` | Session | PRIVATE_MESSAGES_VIEW | Students: own `student_id`; staff: all conversations | Yes | Heads have no message permission |
| `/api/notifications` | Session | Portal roles | `user_id=$req.user.id` | PATCH yes | |
| `/api/parent-contact` | Session | GUARDIAN_CONTACT_VIEW | Student id; office/admin only | Yes | |
| `/api/reports` | Session per route | REPORT_VIEW or department report | Heads forced to own department on DTR | GET | Exports also DATA_EXPORT |
| `/api/audit-logs`, `/api/system`, `/api/high-risk-actions`, `/api/admin/*` | Session | Admin permissions | Target IDs + step-up | Yes | |
| `/api/avatars/:userId/photo` | Session | Self, office/admin, or head with historic session in dept | User id | GET | |
| Socket.IO | Session cookie | Current authz | Rooms rebuilt | Origin/Referer policy | 100 KB buffer |

IDOR samples reviewed: messages `assertConversation`, notifications `user_id=$2`, DTR `effectiveDepartment`, assignment GET `cs.department_id = $2`, day invalidation assignment department vs head, QR assignment list scoped, avatar `readPhoto`.

---

## G. API and Database Security Assessment

- Queries reviewed in this pass use `$n` parameters; `assertAllowedFields` rejects unexpected JSON/query keys on many mutations.
- Body limits: 128kb default; 1500kb signature/avatar routes only.
- Timeouts: HTTP 30s request, statement_timeout 15s, email timeout.
- Errors: 500 responses use generic messages (`utils/api.js`); `console.error` may still print stacks to host logs (protect Render logs).
- SQL injection: no confirmed string-concatenated user SQL in reviewed controllers; message `scope()` SQL fragments are role-constant, not client input.
- XSS: no `dangerouslySetInnerHTML` in frontend source.
- Uploads: PNG/JPEG magic + size; not a full virus scanner.
- Migrations enable RLS on public tables and grant a non-superuser `sti_vio_log_runtime` (NV-04 for live proof).
- Default `DB_SSL=disable` is **rejected in production** by `validateSecureConfig` and `database.js` forbids `no-verify` in production.

---

## H. Infrastructure and Cloud Security

| Platform | In-repo evidence | Unverified |
|---|---|---|
| Vercel | `vercel.mjs` HTTPS CSP, HSTS, frame deny, nosniff, camera=self; production proxy required; preview must not equal production API origin | Preview env vars, Deployment Protection, source maps on CDN |
| Render | Express bind 0.0.0.0, health `/api/health`, CORS allowlist from `FRONTEND_URL`, Helmet | Exact `TRUST_PROXY_HOPS`, TLS to Supabase, log retention, instance size |
| Supabase | Migrations, CI disposable Postgres gate | Console RLS, Data API, PITR |
| GitHub | SHA-pinned actions, `contents: read`, `npm ci --ignore-scripts`, CodeQL, Gitleaks, Dependabot file | Branch protection, org secret scanning alerts |
| Cloudflare | None in repo | DNS/proxy/WAF — treat as absent until owner proves it |

Public unauthenticated surfaces: `/`, `/api/health`, auth login/Google/MFA/recovery, certificate verify. Direct Render URL is reachable; session cookies are first-party on the Vercel host, so stolen Render-origin cookies would not match production cookie Domain.

---

## I. DDoS and Abuse Protection

| Control | Evidence |
|---|---|
| Global IP limiter | 200 / 15 min (`apiLimiter`); authenticated GET failures use a separate failed-access bucket; successful account GETs use per-`user.id` 600 / 15 min |
| Login / Google / MFA | 10 / 15 min plus `authThrottleService` |
| Certificate verify | 30 / 15 min |
| OTP | Resend 60s, 5 verifies |
| Request size / timeouts | Yes |
| Cloudflare WAF / bot | **Not verified** |
| Platform DDoS | Vercel/Render defaults only |
| Safe test this pass | No floods. Rate-limit unit tests exist (`backend/tests/rate-limits.test.js`) |

Application-layer floods can still exhaust a **single Free Render instance**; that is an availability residual, not an auth bypass.

---

## J. Remediation Log

Implemented in this engagement (not committed unless you authorize):

| Change | File | Why |
|---|---|---|
| `requireExactRoles` | `backend/src/middleware/authMiddleware.js` | Role match without blocking onboarding/password-change |
| Route gates | `backend/src/routes/accountRoutes.js` | Student-only onboarding; admin-only profile/email |
| Listen log | `backend/src/server.js` | Remove private LAN IP from process logs |
| Tests | `backend/tests/auth-middleware.test.js`, `backend/tests/account-api.test.js` | Regression for gates |

**Retest (after remediations):** `node --test` on `auth-middleware`, `account-api`, `legal-policy`, `core-rbac.integration`, `csrf`, `rate-limits`, `realtime-security` — **37/37 pass**. CSRF/RBAC tests still reject extra JSON fields and disallowed CORS origins (expected). PostgreSQL `*.pgtest.js` not run (no disposable local DB; avoid production `DATABASE_URL`).

No Critical/High exploit was confirmed, so no Critical/High patch was required beyond the Medium route-gate hardening.

---

## K. Remaining Risks

Owner / operations (do not perform from this agent without separate authorization):

1. Confirm Vercel preview `API_PROXY_ORIGIN` is empty or non-production.
2. Measure `TRUST_PROXY_HOPS` against real `X-Forwarded-For` length.
3. Confirm Supabase: RLS forced, no anon CRUD, runtime role `NOSUPERUSER NOBYPASSRLS`, TLS verify.
4. Encrypted backup restore drill.
5. Enable Terms acknowledgment (`enforcementEnabled`) only with institutional approval.
6. Optional Cloudflare proxy in front of `stiviolog.com` for WAF/DDoS (DNS change — owner only).
7. Install Gitleaks locally or rely on CI; rotate keys if history ever contained secrets.
8. Protect Render logs; they may include stack traces.
9. Restore or stop deleting production frontend image assets in the dirty worktree (availability/branding, not auth).
10. Render plan upgrade if 50–100 concurrent users plus Socket.IO polling saturates Free.

---

## L. Final Security Scorecard

Methodology: **Implemented** = source + local tests; **Gap** = confirmed missing control; **Unverified** = depends on provider/console. Not a 0–100 score.

| Category | Rating |
|---|---|
| Secrets in git | Implemented (examples only); local env Unverified |
| Session / logout / CSRF | Implemented |
| Password / OTP / MFA | Implemented |
| Google eligibility | Implemented |
| RBAC / IDOR (reviewed groups) | Implemented, with Medium route-gate gap **fixed** |
| Input validation / SQLi / XSS | Implemented in reviewed paths |
| Uploads / QR / certificates | Implemented with residual image re-encode Unverified |
| RLS / DB least privilege (live) | Unverified |
| Rate limit / abuse | Implemented in source; platform DDoS Unverified |
| Browser headers / CSP | Implemented (Vercel + Helmet) |
| Logging (no secrets in app JSON) | Implemented with residual stack traces in host logs |
| Legal acknowledgment | Gap (disabled by design) |
| Preview isolation | Source control Implemented; provider Unverified |
| Backups | Unverified |

---

## M. Final Verdict

**CONDITIONALLY READY**

**Reasoning:** Source and local tests show production-oriented session, CSRF, RBAC, Google, OTP, and proxy design. No confirmed Critical/High exploit was reproduced. Remaining blockers for **school handover** are operational: live database grants, proxy hop truth, backups, preview env isolation, Terms enforcement decision, and availability sizing. Until those owner checks are recorded, do not describe the system as penetration-tested or handover-complete.

Use **READY FOR SECURITY REVIEW** only after NV-03, NV-04, NV-05, and NV-06 are evidenced by the deployment owner. Use **NOT READY FOR PRODUCTION** if a later authenticated test finds a working IDOR or auth bypass; none was confirmed here.
