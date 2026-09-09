-- Explicit, expiring support grants. Grants are evaluated from current database
-- state on every authenticated request and are never copied into JWT claims.
CREATE TYPE support_access_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED');

CREATE TABLE support_access_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approver_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 1000),
    affected_module VARCHAR(100) NOT NULL,
    requested_scopes TEXT[] NOT NULL CHECK (cardinality(requested_scopes) > 0),
    approved_scopes TEXT[],
    requested_duration_minutes INTEGER NOT NULL CHECK (requested_duration_minutes BETWEEN 15 AND 480),
    ticket_reference VARCHAR(100),
    read_only BOOLEAN NOT NULL DEFAULT TRUE,
    requested_write_operation VARCHAR(100),
    write_justification TEXT,
    status support_access_status NOT NULL DEFAULT 'PENDING',
    decision_reason TEXT,
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT support_access_different_approver CHECK (approver_user_id IS NULL OR approver_user_id <> requester_user_id),
    CONSTRAINT support_access_write_detail CHECK (
      read_only = TRUE OR (requested_write_operation IS NOT NULL AND char_length(btrim(write_justification)) >= 10)
    )
);

CREATE INDEX idx_support_access_requester_status ON support_access_requests(requester_user_id, status, expires_at);
CREATE INDEX idx_support_access_pending ON support_access_requests(status, created_at DESC);
