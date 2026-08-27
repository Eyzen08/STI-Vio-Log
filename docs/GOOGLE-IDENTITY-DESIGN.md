# Student Google identity linking design

Status: design approved for implementation; no Google authentication code or credentials are introduced by this document.

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

On success, it creates the link and issues the application's normal short-lived JWT. It never creates a student record, changes a role, trusts a client-supplied email, or changes a local password.

### `POST /api/auth/google/login`

Input is limited to `credential`. After token verification, the backend looks up the unique `google_subject`, requires an active linked `STUDENT` account, updates `last_login_at`, and issues the normal application JWT. An unlinked Google identity receives a generic unauthorized response and cannot enter the application.

## Atomic linking algorithm

1. Verify the Google ID token and required claims before querying student identity data.
2. Begin a PostgreSQL transaction.
3. Select the matching school-managed student and active student-role user `FOR UPDATE`.
4. Compare the normalized full name in constant application logic; do not reveal which field mismatched.
5. Insert the identity link. Treat either unique-constraint conflict as an already-linked generic conflict.
6. Insert an audit event containing local user/record IDs and action metadata, never the ID token.
7. Commit, then issue the application JWT.

The row lock plus database uniqueness constraints make simultaneous attempts deterministic. Integration tests must launch parallel linking requests and prove exactly one link and one successful response.

## Audit and recovery

Successful links and rejected duplicate-link attempts are security events. Audit details may include the local user ID, action, outcome, and request metadata already allowed by the audit policy. They must not contain Google tokens or password material.

Self-service unlinking and relinking are intentionally excluded. Recovery requires a separately designed, authenticated, audited administrative workflow with re-verification; direct database edits are not an application workflow.

## Required implementation tests

- valid first-time link and later Google login;
- invalid signature, audience, issuer, expiry, or missing subject;
- unknown student and every name mismatch returning the same public response;
- inactive or non-student account rejection;
- duplicate student link and duplicate Google subject rejection;
- two concurrent link attempts yielding one stored link;
- no token or credential in response bodies, audit details, or application logs;
- existing username/password login remains functional;
- frontend loading, cancellation, retry, unavailable-configuration, and accessible error states.

## Implementation order

1. [x] Migration and migration/concurrency tests.
2. [x] Isolated Google token-verification adapter with mocked unit tests.
3. [x] Transactional link/login service and audit events.
4. Public routes with rate limiting and stable error envelopes.
5. Google Identity Services frontend and account-linking form.
6. Full backend/frontend/integration verification before enabling configuration.

Primary references: [Google backend ID-token verification](https://developers.google.com/identity/sign-in/web/backend-auth) and [Google OpenID Connect claims](https://developers.google.com/identity/openid-connect/reference).
