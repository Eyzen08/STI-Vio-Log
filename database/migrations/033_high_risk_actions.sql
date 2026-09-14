-- Controlled, two-person authorization for sensitive administrative actions.
CREATE TABLE administrative_step_up_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    token_hash CHAR(64) NOT NULL UNIQUE,
    action_type VARCHAR(80) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_id VARCHAR(120) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_administrative_step_up_active
    ON administrative_step_up_tokens(user_id, expires_at DESC)
    WHERE consumed_at IS NULL;

CREATE TABLE high_risk_action_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_user_id BIGINT NOT NULL REFERENCES users(id),
    approver_user_id BIGINT REFERENCES users(id),
    action_type VARCHAR(80) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_id VARCHAR(120) NOT NULL,
    target_version VARCHAR(120) NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
    request_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    before_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_summary JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','APPROVED','REJECTED','EXECUTED','EXPIRED','CANCELLED','FAILED')),
    decision_reason TEXT,
    execution_error_code VARCHAR(100),
    approval_expires_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_high_risk_action_queue
    ON high_risk_action_requests(status, created_at DESC);
CREATE INDEX idx_high_risk_action_requester
    ON high_risk_action_requests(requester_user_id, created_at DESC);

REVOKE UPDATE, DELETE ON high_risk_action_requests FROM PUBLIC;

