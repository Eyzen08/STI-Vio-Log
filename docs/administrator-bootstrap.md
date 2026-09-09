# Administrator bootstrap

Run migrations first. Bootstrap is disabled unless `ADMIN_BOOTSTRAP_ENABLED=true` is supplied to the one command. Use an individual identity; never create a shared administrator.

Set `ADMIN_BOOTSTRAP_USERNAME`, `ADMIN_BOOTSTRAP_FIRST_NAME`, `ADMIN_BOOTSTRAP_LAST_NAME`, and optionally `ADMIN_BOOTSTRAP_EMAIL` in a protected process environment. Set `ADMIN_BOOTSTRAP_PASSWORD` to a policy-compliant temporary password, or omit it to generate one that is displayed once. Then run:

```powershell
npm run bootstrap:admin -- --role=SYSTEM_ADMIN
npm run bootstrap:admin -- --role=DISCIPLINE_ADMIN
```

Run each role once. The command takes a database transaction-level advisory lock, refuses to run when that administrator role already exists, hashes the credential with bcrypt cost 12, creates an audit event without the credential, and forces a password change at first login. Afterward, remove every `ADMIN_BOOTSTRAP_*` value from the process environment; the feature is disabled by default on the next command. Do not save generated credentials in source control, terminal transcripts, tickets, or ordinary logs.

Recovery is intentionally separate from bootstrap. If a role already exists, use the audited account-recovery workflow; do not delete or rename the existing account to rerun bootstrap.
