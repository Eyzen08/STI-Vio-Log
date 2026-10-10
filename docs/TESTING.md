# Testing and verification evidence

Evidence date: **October 10, 2026, Asia/Manila**. Source baseline: `3601e16031c36d08308176d9c7807d02198ac7b8`. These are executed checks, not academic evaluation or institutional acceptance.

## Executed checks

| Working directory | Actual command | Outcome and scope |
|---|---|---|
| backend | `npm.cmd test` | 334/334 passing, exit 0 after approved unrestricted rerun. Node test runner; mocked SQL, unit logic and local HTTP API tests. |
| frontend | `npm.cmd test` | 438/438 passing, exit 0 after approved unrestricted rerun. Helpers, source assertions and selected Vite/React SSR rendering. No full browser journey. |
| frontend | `npm.cmd run lint` | Exit 0, ESLint with zero warnings permitted. |
| frontend | `npm.cmd run audit:performance` | Exit 0. Runs `npm run build` (Vite 8.2.1) then the asset-size budget. Largest JS approximately 368.7 kB and CSS 177.9 kB, below 400,000/200,000-byte limits. This is a bundle budget, not latency or load testing. |
| backend and frontend, separately | `npm.cmd audit --json` | Both exit 0: zero reported registry advisories, including development dependencies, at this date. Not a code/security audit. |
| backend | `node --test --test-concurrency=1 tests/*.pgtest.js` | All 10 PostgreSQL test files executed: 49 tests, **48 passing, 1 failing**, exit 1. Fresh isolated PostgreSQL 18.6 cluster on loopback; no shared database. |
| backend | `npm.cmd run smoke:production` | Exit 0. Explicit canonical frontend/API URLs; read-only GET/OPTIONS health, proxy, login route, unauthenticated 401 boundaries and CORS allow/deny. No login, business writes, email or student-record reads. |

Local runtime: Windows/PowerShell, Node 24.18.1, npm 11.16.0. Manifests require Node 24.x/npm 11.x. PostgreSQL client/server 18.6 was used for disposable integration; the observed hosted database is 17.6, so this does not prove identical provider-version behavior. PostgreSQL 17 was not run: only 18.6 local binaries were found and Docker was unavailable.

The initial restricted backend run had five loopback EACCES failures (329/334 passed); the frontend run had 48 failures and one cancellation (389/438 passed), including Vite SSR `module is not defined`. Initial npm registry access failed with ENOTFOUND. Authorized reruns outside that restriction passed. Preserve these attempts as environment failures. Unrestricted GitHub CI metadata retrieval later could not execute because automatic approval review hit an account usage limit.

Audit transcripts are ignored temporary evidence under `.cache/documentation-audit/`: `backend-tests-unrestricted.log`, `frontend-tests-unrestricted.log`, `lint.log`, `performance.log`, the two `*-audit-unrestricted.json` reports, `postgres-tests.log` and `production-smoke.log`. They are not committed fixtures and may be unavailable in another checkout. Existing older logs remain historical unless their provenance is independently established.

## Database result and safety

The integration harness and hooks were inspected: `backend/tests/testDatabase.js` requires an explicit test URL distinct from runtime/migration settings, guards `sti_vio_log_test_*` schema names, and never falls back to application credentials. Tests create synthetic rows, disposable schemas and some test roles. A different schema in a shared database is insufficient authorization.

A new cluster was initialized under ignored audit scratch with `initdb -A trust -U audit_owner --encoding=UTF8 --no-locale`, bound explicitly to `127.0.0.1:55439`. `SELECT version(), inet_server_addr(), inet_server_port(), current_database()` confirmed PostgreSQL 18.6, loopback, that port and the new cluster's `postgres` database before execution. The process received that synthetic cluster's `TEST_DATABASE_URL`, `NODE_ENV=test`, and `DB_SSL=disable`. Trust authentication was confined to this disposable loopback instance. It was stopped with `pg_ctl -m fast -w stop` in a finally block; it is not an application database. Synthetic scratch files may remain ignored locally.

Failure: `student-academic.pgtest.js:39` expects `result.applied` to contain only `043_student_academic_strands.sql`, but the fixture starts at migration 042 and the runner applies **043–050**. The first test fails before its later academic assertions. Other academic cases and fresh/legacy migration suites passed. This is a confirmed stale test expectation, not proof that all later assertions would pass after repair. Tests/application remain unchanged. Follow-up: isolate migration 043 or derive the complete pending list, then rerun on disposable PostgreSQL 17 and 18.

## Repeating safe checks

Run these in the named application directories:

```powershell
# backend
npm.cmd test
npm.cmd audit --json
# frontend
npm.cmd test
npm.cmd run lint
npm.cmd run audit:performance
npm.cmd audit --json
```

For database suites, create and verify an explicitly disposable database with no real records or runtime connection. Set `TEST_DATABASE_URL` privately; never use application credentials. Reinspect side effects if the suites change.

```powershell
# backend, after the disposable target is verified
node --test --test-concurrency=1 tests/*.pgtest.js
```

Existing subsets are `test:migrations`, `test:violation-integration`, `test:attendance-integration`, `test:academic`, `test:avatars` and `test:account-security`. Normal `npm test` excludes `.pgtest.js`. A filename containing `integration.test.js` does not mean a real database or browser was exercised.

Production smoke requires explicit `PRODUCTION_FRONTEND_URL` and `PRODUCTION_API_URL` and is read-only. `migrate`, `bootstrap:admin`, seeds and `backup` have database/storage side effects. Even `migrate:status` creates `schema_migrations` if absent; it is not an unconditional read-only provider check. `security:database` was inspected but not executed against production runtime credentials.

## Evidence by layer

| Layer | Evidence obtained | Evidence still needed |
|---|---|---|
| Source/API permissions | Route/middleware/service trace and unit/mocked API checks | Independent security review and authenticated production boundaries. |
| Persistence/concurrency | Synthetic PostgreSQL migrations, attendance, rollback, corrections and account suites | Repair one failing test; same suites on provider major version; realistic volume. |
| Frontend | Helpers, assertions, selected SSR, lint/build | Browser/device workflows, keyboard/screen reader and manual accessibility assessment. |
| QR/timing | Timing edges and synthetic DB writes | Cameras, interrupted networks, multi-device scans, midnight/final-remainder acceptance. |
| Identity/email | Mocked verifier/email tests and sender metadata | Controlled OAuth, OTP/reset/credentials/certificate delivery and failure recovery. |
| Deployment | Matching deployed SHA and public smoke | Authenticated journeys, actual runtime versions, configuration presence and monitored availability. |
| Research | Repository evidence and local results | Approved instruments, participants, acceptance, usability/effectiveness data and analysis. |

No Playwright/Cypress journey suite, coverage-percentage report, TypeScript checking, dedicated formatter, load benchmark or penetration-test result was found in project configuration. Accessibility foundation tests are not certification. Gitleaks, CodeQL and SBOM jobs are configured in `.github/workflows/security.yml`; current CI outcomes were unavailable. Local tests do not replace those jobs.

## Acceptance

Use [the acceptance checklist](FINAL-ACCEPTANCE-CHECKLIST.md) and [security release gate](security/STAGING-AND-PRODUCTION-GATE.md). Record tester, time, source/deployment SHA, role, synthetic fixture, browser/device, expected/actual outcome and evidence. Exclude passwords, cookies, OTPs, Google credentials and real student details from screenshots/logs. Unchecked boxes remain unexecuted acceptance work.
