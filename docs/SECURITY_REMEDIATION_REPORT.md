# STI Vio-Log Security Remediation Report

**Date:** 11 November 2026  
**Source (this pass):** local tree including Helmet API header hardening (not deployed unless you approve)  
**Deployed production at inspection:** `1255e0e` (Render `dep-dbphdo67bikc73dk9gb0`; Vercel alias https://stiviolog.com)  
**Companion:** [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)  
**Scope:** Source review, local Node tests, unauthenticated public HTTP headers, public DNS. No authenticated production probes, no ZAP, no DNS edits, no deploy, no Redis, no restore over production.  
**This report is not an OWASP or pentest certificate.**

Status labels: **VERIFIED** | **FIXED AND TESTED** | **PARTIALLY IMPLEMENTED** | **NEEDS VERIFICATION** | **NOT IMPLEMENTED** | **BLOCKED** | **NOT APPLICABLE**

---

## Inspection notes (A–I)

### A. Headers and CSP

Unauthenticated `curl -sI` on 11 Nov 2026:

| URL | Result |
|---|---|
| `https://stiviolog.com/` | Vercel. CSP matches `frontend/vercel.mjs` (Google GSI, `frame-ancestors 'none'`, HSTS 63072000 preload, `X-Frame-Options: DENY`, nosniff, Permissions-Policy camera=(self)). **`vercel.mjs` is recognized in production.** |
| `https://stiviolog.com/login` | Same Vercel header set. |
| `https://stiviolog.com/api/health` | Vercel proxy + Render. SPA CSP/HSTS/DENY from Vercel; `Cache-Control: no-store`; `Ratelimit-Limit: 200`. `Cf-Ray` here is **forwarded from Render**, not proof the apex uses Cloudflare DNS. |
| `https://sti-vio-log.onrender.com/api/health` | Helmet HTML **defaults** mixed in: `font-src 'self' https: data:`, `style-src ... 'unsafe-inline'`, `X-Frame-Options: SAMEORIGIN`. `Server: cloudflare` is **Render’s platform** on `onrender.com`. |

HTML CSP in `vite.config.js` is a meta tag for local/build; production browser policy is the Vercel response header. `style-src 'unsafe-inline'` remains required for Google GSI. Direct Render JSON API does not need HTML font/script defaults.

**Fix (local, not deployed):** `applyApiSecurityHeaders` in `backend/src/config/security.js` sets Helmet `useDefaults: false`, `frameguard: deny`. Test: `API security headers deny framing and do not inherit Helmet HTML defaults` — PASS.

### B. DNS / Cloudflare

| Record | Value |
|---|---|
| NS | `ns57.domaincontrol.com`, `ns58.domaincontrol.com` (**GoDaddy**, not Cloudflare) |
| `stiviolog.com` A | `216.198.79.1` (Vercel anycast) |
| `www.stiviolog.com` CNAME | `*.vercel-dns-017.com` |
| TXT | none returned in this query |

**Project Cloudflare WAF on stiviolog.com: NOT IMPLEMENTED.** Optional orange-cloud would need owner DNS change and Vercel compatibility review. Registrar lock, 2FA, auto-renew: **BLOCKED** (no GoDaddy login).

### C. Rate limits

In-memory `express-rate-limit` on **one** Render Free instance is appropriate. **Redis not added.**

| Bucket | Limit | Mount |
|---|---|---|
| Public + writes | 200 / 15 min / IP | `apiLimiter` |
| Failed authenticated GET | 200 / 15 min / IP | `failedAccess` |
| Successful account GET | 600 / 15 min / `user.id` | `verifiedReadLimiter` |
| Login, MFA, student recovery | 10 / 15 min | `sensitiveAuthLimiter` |
| Google login | 10 / 15 min | `googleAuthLimiter` |
| Certificate verify | 30 / 15 min | `certificateVerificationLimiter` |
| OTP | 60s resend, 5 verifies | `otpService` |
| High-risk step-up | route limiter | `highRiskActionRoutes` |

`trust proxy` = integer `TRUST_PROXY_HOPS` (1–3 required in production). Exact hop count vs Vercel→Render: **NEEDS VERIFICATION**. Unbounded `X-Forwarded-For` is not used as a custom parser. Scaling to multiple API instances would split in-memory counters (**remaining limitation**).

### D. IDOR / BOLA

No new confirmed object-level bypass. Existing tests still pass. Added regression: student certificate PDF SQL requires `s.user_id=$2`. Avatar `readPhoto` already 404s unrelated students.

### E. Backups

`backend/scripts/backup.js` + `backup-script.test.js` exist (encrypted dump path outside repo/OneDrive). Live Supabase PITR/plan: **NEEDS VERIFICATION**. Restore drill: **BLOCKED**.

### F. Scans

- `npm audit --omit=dev`: **0** high+ (backend and frontend), 11 Nov 2026.  
- Gitleaks/ZAP binaries: **not installed**. ZAP: **NOT TESTED**. CI workflow still defines Gitleaks/CodeQL.

### G. Logging

`LOGIN_PASSWORD` DENIED/FAILED/SUCCESS (admin) recorded via `recordSecurityEvent`. `AUTHORIZATION_DENIED` audited. `sanitizeDetails` redacts password/otp/token keys (`administrative-audit-hardening.test.js` PASS). Host `console.error` may still print stacks. No SIEM.

### H. OTP

Hashed, 10 min, 5 tries, 60s resend, `used_at`. SQL `cleanup_ephemeral_data()` deletes OTPs only after `expires_at + 24 hours`. pg_cron schedule exists in migration **if** public schema + extension; runtime role is revoked. Whether cron runs on Supabase: **NEEDS VERIFICATION**. Reuse of used/expired codes remains blocked even without cleanup.

### I. Uploads / signatures

PNG/JPEG magic bytes, size/dimension caps, `ESIGNATURE_MANAGE`, student certificate ownership. Full pixel re-encode: **PARTIALLY IMPLEMENTED** (NV-02 residual).

---

## Table 1 – Security findings

| Security Area | Finding | Severity | Evidence | Status |
|---|---|---|---|---|
| A Headers (Vercel) | SPA headers match `vercel.mjs` | — | `curl -sI https://stiviolog.com/` 11 Nov 2026 | VERIFIED |
| A Headers (Render API) | Helmet HTML defaults on JSON API (`font-src https:`, XFO SAMEORIGIN) | Low | Direct `/api/health` vs source intent | FIXED AND TESTED (local; **not deployed**) |
| B Cloudflare apex | GoDaddy NS; Vercel A/CNAME; not Cloudflare nameservers | — | `Resolve-DnsName` | VERIFIED (WAF **NOT IMPLEMENTED**) |
| B Registrar lock/2FA | Cannot see GoDaddy console | — | No login | BLOCKED |
| C Redis | Not needed for 1 Free instance | — | Render `numInstances: 1` (prior MCP) | NOT APPLICABLE |
| C TRUST_PROXY_HOPS | Integer required; live hop count unknown | — | `security.js` + live unverified | NEEDS VERIFICATION |
| D IDOR | No new confirmed bypass this pass | — | 71 tests including RBAC/avatar/certs | VERIFIED |
| E PITR / restore | Not exercised | — | No staging DB | BLOCKED |
| F ZAP | Not run | — | No binary / no staging | NOT TESTED (treat as NOT IMPLEMENTED scan) |
| F npm audit | 0 high+ omit-dev | — | npm 11 Nov 2026 | VERIFIED |
| G Logging secrets | Keys redacted in security events | — | hardening tests | VERIFIED |
| G Stack traces | `console.error` to Render logs | Low | source | PARTIALLY IMPLEMENTED |
| H OTP reuse | Blocked in service | — | otp tests / source | VERIFIED |
| H OTP row cleanup | Function + cron in SQL; live cron unknown | — | migration 036 | NEEDS VERIFICATION |
| I Image re-encode | Magic bytes only | Low | parsers + NV-02 | PARTIALLY IMPLEMENTED |

---

## Table 2 – Fixes applied

| Vulnerability / Issue | Root Cause | Fix Implemented | Files Changed | Test Result |
|---|---|---|---|---|
| API Helmet inherited HTML CSP defaults | Partial `directives` still merge Helmet defaults | `applyApiSecurityHeaders`: `useDefaults: false`, `frameguard: deny` | `backend/src/config/security.js`, `backend/src/server.js`, `backend/tests/security-config.test.js` | PASS (`API security headers deny framing…`) |
| Student certificate PDF IDOR (regression only) | — | No product change; asserted `AND s.user_id=$2` | `backend/tests/clearance-certificate.test.js` | PASS |
| OTP cleanup SQL hygiene (regression) | — | Assert DELETE uses `expires_at+24h` | same test file | PASS |

Prior C-01/C-02 remain in deployed `1255e0e`. Helmet change is **not live** until Render deploy is approved.

---

## Table 3 – Infrastructure verification

| Platform | Security Setting | Current Status | Evidence | Required Action |
|---|---|---|---|---|
| Vercel | CSP/HSTS/frame deny | VERIFIED on apex | Live headers | Keep; confirm preview `API_PROXY_ORIGIN` in dashboard (NV-05) |
| Render | Helmet API CSP | Live still old defaults | Direct health headers | Deploy this pass when you approve |
| Render | `TRUST_PROXY_HOPS` | NEEDS VERIFICATION | Fail-closed if missing | Measure hop count |
| Render | Cloudflare on `onrender.com` | VERIFIED platform CF | `Server: cloudflare` | Not a substitute for apex WAF |
| GoDaddy | Nameservers | VERIFIED domaincontrol | DNS NS | Lock/2FA/expiry in console (BLOCKED here) |
| Cloudflare (apex) | WAF | NOT IMPLEMENTED | NS not Cloudflare | Optional owner DNS change |
| Supabase | RLS live / PITR | NEEDS VERIFICATION | Migrations only | Console + restore in a **copy** project |
| GitHub | security.yml | VERIFIED in source | workflow file | Org alerts NEEDS VERIFICATION |
| Brevo / Google | Keys / origins | NEEDS VERIFICATION | not printed | Keep server-side; authorized origins |

---

## Table 4 – Penetration testing results

| Attack / Test | Result | Severity | Remediation | Retest Result |
|---|---|---|---|---|
| Unauthenticated header inspection | SPA policy present | — | None | VERIFIED |
| SQL injection (extra JSON fields) | Rejected in core-rbac | — | Existing `assertAllowedFields` | PASS |
| CSRF | Invalid token 403 | — | Existing double-submit | PASS |
| Student-to-student `student_id` | 400 unsupported field | — | Existing | PASS |
| Avatar photo other user | 404 | — | Existing `readPhoto` | PASS |
| Department attendance other dept | 404 / field reject | — | Existing | PASS |
| Login 10/15 min | Enforced | — | Existing | PASS |
| npm audit high+ | 0 | — | — | VERIFIED |
| OWASP ZAP | Not executed | — | — | NOT TESTED |
| Gitleaks local | Binary absent | — | CI defined | NOT TESTED |
| DDoS flood | Not executed | — | — | NOT TESTED |
| Authenticated production IDOR | Not executed | — | — | NOT TESTED |

---

## Table 5 – Remaining risks

| Remaining Risk | Why It Remains | Impact | Recommended Action |
|---|---|---|---|
| Live API still has Helmet defaults | Fix not deployed | Low clickjacking/CSP on JSON origin | Approve Render deploy of this commit |
| TRUST_PROXY hop mismatch | Needs packet/header length | Rate-limit IP distortion | Owner measures hops |
| In-memory limits | One instance today | Multi-instance would split budgets | Add Redis only if you scale out |
| No apex WAF | GoDaddy → Vercel | Volumetric DDoS / bots | Optional Cloudflare (approval) |
| Live RLS / Data API | Dashboard not opened | Defense-in-depth unknown | Owner console check |
| pg_cron OTP purge | Extension may be off | Table growth, not reuse | Confirm cron or scheduled maintenance |
| Backups untested | No staging restore | Recovery unproven | Copy-project restore drill |
| Image polyglot residual | No re-encode | Low malware in PNG | Optional sanitizing decoder |
| Render Free availability | Single instance | DoS of API | Paid instance if needed |
| Terms enforcement off | By design | Policy gate unused | School decision |

---

## Table 6 – Production readiness

| Requirement | Status | Evidence | Next Step |
|---|---|---|---|
| All eight workstreams reviewed | VERIFIED | This document | — |
| Confirmed High/Critical app vulns | None this pass | Hunt + 71 tests | — |
| Authorization tests | VERIFIED | 71/71 listed suite 11 Nov 2026 | Keep in CI |
| Production SPA headers | VERIFIED | curl apex | — |
| Production API Helmet | PARTIALLY IMPLEMENTED | Live old; local FIXED AND TESTED | Deploy when approved |
| Rate limit + trust proxy | PARTIALLY IMPLEMENTED | Source + tests; hops unknown | Measure hops |
| Backup/restore tested off prod | BLOCKED | — | Staging project |
| OTP lifecycle | VERIFIED reuse; cleanup NEEDS VERIFICATION | source + SQL test | Confirm pg_cron |
| Uploads/signatures reviewed | VERIFIED with residual | avatar + certificate tests | Optional re-encode |
| Scans | PARTIALLY IMPLEMENTED | npm audit yes; ZAP no | Optional staging ZAP |
| Core features not rewritten | VERIFIED | Helmet-only product change | — |
| Manual config documented | VERIFIED | Tables 3 and 5 | Owner checklists |

**Verdict unchanged: CONDITIONALLY READY.** Application controls hold in source and tests. Helmet API header fix should be deployed to match the local test. Operational items (PITR, hops, preview env, Cloudflare, restore) remain owner work.

---

## Test commands executed (11 November 2026)

```
curl.exe -sI https://stiviolog.com/
curl.exe -sI https://stiviolog.com/login
curl.exe -sI https://stiviolog.com/api/health
curl.exe -sI https://sti-vio-log.onrender.com/api/health
Resolve-DnsName stiviolog.com / www / NS / TXT
npm audit --omit=dev --audit-level=high   # backend and frontend: 0 vulnerabilities
node --test tests/security-config.test.js tests/clearance-certificate.test.js tests/avatar.test.js tests/auth-middleware.test.js tests/account-api.test.js tests/core-rbac.integration.test.js tests/csrf-bootstrap.test.js tests/rate-limits.test.js tests/realtime-security.test.js tests/department-isolation.test.js tests/https-enforcement.test.js tests/administrative-audit-hardening.test.js
```

**Result:** 71/71 PASS. `*.pgtest.js` not run (avoid production `DATABASE_URL`). Gitleaks/ZAP not run.

## Discipline Office recovery procedure (not executed)

1. Do not restore over production until a copy project exists.  
2. Use `backend/scripts/backup.js` to an absolute path outside the repo and OneDrive, with `BACKUP_ENCRYPTION_KEY` set.  
3. Restore that dump into a **new** Supabase/Postgres instance.  
4. Confirm `schema_migrations`, RLS, and `cleanup_ephemeral_data` exist.  
5. Point a non-production `DATABASE_URL` at the copy and run health + login with a test account.  
6. Only then plan a maintenance window for production.

## Deploy steps (not performed)

1. Review `git diff` for Helmet + tests + this report.  
2. Commit and push when you approve.  
3. Render auto-deploys `main`; confirm `/api/health` CSP has `default-src 'none'` **without** `font-src https:` and `X-Frame-Options: DENY`.  
4. Do not change GoDaddy DNS unless you separately approve Cloudflare.
