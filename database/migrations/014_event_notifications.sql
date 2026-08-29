-- Event keys make transactional notifications retry-safe without exposing
-- internal actor or identity data to recipients.
ALTER TABLE notifications
    ADD COLUMN event_key VARCHAR(255),
    ADD COLUMN read_at TIMESTAMPTZ;

UPDATE notifications
SET read_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE is_read = TRUE AND read_at IS NULL;

CREATE UNIQUE INDEX uq_notifications_event_key
    ON notifications (event_key) WHERE event_key IS NOT NULL;

CREATE INDEX idx_notifications_user_unread
    ON notifications (user_id, created_at DESC) WHERE is_read = FALSE;

ALTER TABLE notifications ADD CONSTRAINT notifications_read_state_check CHECK (
    (is_read = FALSE AND read_at IS NULL)
    OR (is_read = TRUE AND read_at IS NOT NULL)
);
