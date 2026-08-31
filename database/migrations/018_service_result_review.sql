ALTER TABLE community_service_sessions
    ADD COLUMN IF NOT EXISTS service_condition VARCHAR(30),
    ADD COLUMN IF NOT EXISTS result_notes TEXT,
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN IF NOT EXISTS reviewed_by_user_id BIGINT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_notes TEXT;

ALTER TABLE community_service_sessions
    DROP CONSTRAINT IF EXISTS community_service_session_review_status_check;
ALTER TABLE community_service_sessions
    ADD CONSTRAINT community_service_session_review_status_check
    CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED'));

ALTER TABLE community_service_sessions
    DROP CONSTRAINT IF EXISTS community_service_session_condition_check;
ALTER TABLE community_service_sessions
    ADD CONSTRAINT community_service_session_condition_check
    CHECK (service_condition IS NULL OR service_condition IN ('SATISFACTORY', 'NEEDS_FOLLOW_UP', 'INCIDENT_REPORTED'));

-- Existing credited sessions predate review and remain approved. New time-outs
-- explicitly set PENDING and carry zero credit until DO/Admin review.
CREATE INDEX IF NOT EXISTS idx_service_sessions_review
    ON community_service_sessions (review_status, time_out DESC)
    WHERE status = 'COMPLETED';
