-- Structured, append-only administrative/security audit foundations.
ALTER TABLE audit_logs
    ADD COLUMN actor_role VARCHAR(50),
    ADD COLUMN effective_permissions TEXT[],
    ADD COLUMN target_label VARCHAR(255),
    ADD COLUMN previous_values JSONB,
    ADD COLUMN new_values JSONB,
    ADD COLUMN reason TEXT,
    ADD COLUMN user_agent VARCHAR(500),
    ADD COLUMN request_id UUID,
    ADD COLUMN result VARCHAR(20) CHECK (result IS NULL OR result IN ('SUCCESS','DENIED','FAILED')),
    ADD COLUMN support_access_request_id BIGINT REFERENCES support_access_requests(id) ON DELETE RESTRICT;

CREATE TABLE administrative_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id BIGINT,
    actor_readable_name VARCHAR(255),
    actor_role VARCHAR(50),
    effective_permissions TEXT[],
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(100),
    target_label VARCHAR(255),
    safe_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent VARCHAR(500),
    request_id UUID,
    result VARCHAR(20) NOT NULL CHECK (result IN ('SUCCESS','DENIED','FAILED')),
    support_access_request_id BIGINT REFERENCES support_access_requests(id) ON DELETE RESTRICT
);

CREATE INDEX idx_administrative_security_events_time ON administrative_security_events(occurred_at DESC);
CREATE INDEX idx_administrative_security_events_actor ON administrative_security_events(actor_user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit records are append-only';
END;
$$;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

CREATE TRIGGER administrative_security_events_append_only
BEFORE UPDATE OR DELETE ON administrative_security_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
