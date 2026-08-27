# Student Google identity linking design

Status: implemented with enrollment-gated registration; live Google configuration remains environment-specific.

## Security boundary

The browser sends a Google ID token to the backend over HTTPS. The backend verifies its signature and the `aud`, `iss`, and `exp` claims using Google's Node.js authentication library and the configured web client ID. The stable, case-sensitive Google `sub` claim is the external identity key. Email and display name are informational only and must never be used as unique identity keys.

Configuration uses placeholders only:

```text
GOOGLE_CLIENT_ID=<google-web-client-id>.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=<same-public-web-client-id>.apps.googleusercontent.com
```

No Google client secret is required for ID-token verification in this flow. No ID token, access token, JWT, or credential may be logged or persisted.

## Data model

Add a migration-created `google_identity_links` table:

```text
id                 BIGSERIAL PRIMARY KEY
user_id            BIGINT NOT NULL UNIQUE REFERENCES users(id)
google_subject     VARCHAR(255) NOT NULL UNIQUE
google_email       VARCHAR(255)
linked_at          TIMESTAMPTZ NOT NULL
last_login_at      TIMESTAMPTZ
```

The two unique constraints are mandatory: one Google identity can link to only one local account, and one local account can have only one Google identity. Email is deliberately not unique and is not used for lookup.

## Public contracts

### `POST /api/auth/google/link`

Input is limited to `credential`, `student_number`, `first_name`, `last_name`. The backend verifies the Google ID token first, normalizes human-entered whitespace/case for comparison, and finds one existing active `STUDENT` user through the school-managed student record. It returns the same generic rejection for a missing record, mismatched name, inactive account, or already-linked student so the endpoint cannot enumerate private student data.

When the supplied identity matches an existing active student, success creates the link and issues the application's normal short-lived JWT.

When no student number exists, the endpoint creates only a `PENDING` enrollment-verification request and returns HTTP 202 without a user, student record, QR code, link, or session. A duplicate student number, conflicting pending request, mismatched existing identity, inactive account, or already-linked identity receives a generic rejection. Google email is stored for authorized review only when Google marks it verified.

An authenticated `ADMIN` or `DISCIPLINE_OFFICE` reviewer must verify official enrollment and record a reason. Approval atomically creates the active `STUDENT` user, student profile, opaque QR code, Google link, and audit events. Rejection retains the request and reason without creating portal access. Pending and rejected applicants cannot authenticate.

### `POST /api/auth/google/login`

Input is limited to `credential`. After token verification, the backend looks up the unique `google_subject`, requires an active linked `STUDENT` account, updates `last_login_at`, and issues the normal application JWT. An unlinked Google identity receives a generic unauthorized response and cannot enter the application.

## Atomic linking algorithm

1. Verify the Google ID token and required claims before querying student identity data.
2. Begin a PostgreSQL transaction.
3. Select the matching school-managed student and active student-role user `FOR UPDATE`.
4. For an existing student, compare the normalized name, create the link and audit event, commit, and issue the application JWT.
5. For a new unique student number, create a concurrency-protected pending registration and token-free audit event, then return without a session.
6. On authorized approval, lock the pending request and recheck user, student-number, and Google-subject uniqueness.
7. Atomically create the student user/profile, opaque QR, link, review state, and audit events. Rejection updates review state and preserves history.

The row lock plus database uniqueness constraints make simultaneous attempts deterministic. Integration tests must launch parallel linking requests and prove exactly one link and one successful response.

## Audit and recovery

Successful links and rejected duplicate-link attempts are security events. Audit details may include the local user ID, action, outcome, and request metadata already allowed by the audit policy. They must not contain Google tokens or password material.

Self-service unlinking and relinking are intentionally excluded. Recovery requires a separately designed, authenticated, audited administrative workflow with re-verification; direct database edits are not an application workflow.

## Required implementation tests

- valid first-time link and later Google login;
- invalid signature, audience, issuer, expiry, or missing subject;
- unknown students receiving a pending response without portal access, while existing mismatches remain generic;
- inactive or non-student account rejection;
- duplicate student link and duplicate Google subject rejection;
- two concurrent link attempts yielding one stored link;
- no token or credential in response bodies, audit details, or application logs;
- existing username/password login remains functional;
- frontend loading, cancellation, retry, unavailable-configuration, and accessible error states.
- pending submission, reviewer authorization, approval/rejection, duplicate prevention, and post-approval Google login.

## Implementation order

1. [x] Migration and migration/concurrency tests.
2. [x] Isolated Google token-verification adapter with mocked unit tests.
3. [x] Transactional link/login service and audit events.
4. [x] Public routes with rate limiting and stable error envelopes.
5. [x] Google Identity Services frontend and account-linking form.
6. [x] Enrollment-gated registration migration, reviewer APIs, frontend states, and contract tests.
7. Full live Google submission, approval, and returning-login verification.

Primary references: [Google backend ID-token verification](https://developers.google.com/identity/sign-in/web/backend-auth) and [Google OpenID Connect claims](https://developers.google.com/identity/openid-connect/reference).
