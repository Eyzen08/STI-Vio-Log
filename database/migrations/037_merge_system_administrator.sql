-- Merge technical administration into DISCIPLINE_ADMIN while preserving all
-- identities, MFA enrollment, references, and historical workflow records.

ALTER TABLE administrative_step_up_tokens
    ADD COLUMN IF NOT EXISTS target_version VARCHAR(120);

UPDATE administrative_step_up_tokens
SET consumed_at = COALESCE(consumed_at, CURRENT_TIMESTAMP)
WHERE consumed_at IS NULL;

UPDATE users
SET role = 'DISCIPLINE_ADMIN',
    session_version = session_version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE role = 'SYSTEM_ADMIN';

UPDATE support_access_requests
SET status = 'REVOKED',
    revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
    decision_reason = COALESCE(decision_reason, 'Support-access workflow retired after administrator role merge'),
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('PENDING', 'APPROVED');

UPDATE high_risk_action_requests
SET status = 'CANCELLED',
    cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP),
    decision_reason = COALESCE(decision_reason, 'Two-person approval workflow retired after administrator role merge'),
    updated_at = CURRENT_TIMESTAMP
WHERE status IN ('PENDING', 'APPROVED');

COMMENT ON TYPE user_role IS
    'DISCIPLINE_ADMIN owns institutional and technical administration. SYSTEM_ADMIN and ADMIN are retained only as inactive historical enum labels.';
