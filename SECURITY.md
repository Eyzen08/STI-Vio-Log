# Security policy

Report suspected vulnerabilities privately to the designated STI Global City system administrator. Do not open a public issue containing student records, credentials, tokens, exploit steps, or screenshots of protected data.

## Incident-response checklist

1. Record the reporter, detection time, affected environment, and incident owner without copying sensitive record contents.
2. Preserve immutable audit, Vercel, API, and Supabase logs; do not destroy evidence or restore over the affected database.
3. Contain access by revoking affected browser sessions, disabling compromised accounts, restricting database/network access, and pausing writes when required.
4. Rotate only the exposed credentials first, then deploy and validate replacements. Treat any exposed database, session, CSRF, OTP, MFA, certificate, backup, Google, or email key as compromised.
5. Determine the affected users, records, time window, and legal/privacy notification duties. Notify the school's privacy and security owners whenever student or guardian information may be involved.
6. Recover into a separate environment, validate integrity and role boundaries, monitor for recurrence, and document the timeline and lessons learned.

Production releases require the security workflow, an isolated Supabase migration, a Vercel preview smoke test, and promotion of the already-tested artifact. Review privileged access and restore an encrypted backup quarterly. Retain security/audit data according to the school's approved privacy schedule; do not invent or silently extend retention periods.

## Key rotation

Cryptographic keys must be independent and stored as encrypted environment variables or an approved secret manager. Rotate one purpose at a time, create a new deployment, validate it, revoke all sessions/challenges affected by the old key, and retire the old key after the maximum eight-hour session lifetime. Certificate and encrypted-backup keys require an explicit re-signing or re-encryption migration before retirement. Preview deployments must never receive production database credentials.

## Retention and review

The school data owner must approve concrete audit, security-event, incident, and backup retention periods; application operators may not silently shorten or extend them. Legal hold overrides routine deletion. Access to retained logs must be audited, and exported copies must be encrypted and deleted when their approved purpose ends.

Quarterly, review privileged accounts, Supabase roles/RLS/grants, Vercel environment scopes, dependency alerts, CSP reports, restore capability, incident contacts, and key age. Run and record an isolated encrypted-backup restore. Also perform this review after a material authentication, database, or hosting change.
