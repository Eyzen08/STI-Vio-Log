-- Security notifications are separately filterable and acknowledgeable.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notification_category_check;
ALTER TABLE notifications ADD CONSTRAINT notification_category_check CHECK (
    category IN ('MESSAGES','ATTENDANCE','VIOLATIONS','COMMUNITY_SERVICE','CLEARANCE','SYSTEM','SECURITY')
);
ALTER TABLE notifications
    ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'INFO'
        CHECK (severity IN ('INFO','WARNING','CRITICAL')),
    ADD COLUMN acknowledged_at TIMESTAMPTZ;
CREATE INDEX idx_notifications_security_unacknowledged
    ON notifications(user_id,created_at DESC)
    WHERE category='SECURITY' AND acknowledged_at IS NULL;
