-- Authoritative officer availability, department responsibility, and
-- supervising-officer history for community-service attendance.

CREATE TABLE officer_availability (
    officer_user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    availability_status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    reason TEXT,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by_admin_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT officer_availability_status_check
        CHECK (availability_status IN ('AVAILABLE', 'UNAVAILABLE', 'ABSENT')),
    CONSTRAINT officer_availability_reason_check
        CHECK (availability_status = 'AVAILABLE' OR BTRIM(COALESCE(reason, '')) <> '')
);

CREATE TABLE officer_department_assignments (
    id BIGSERIAL PRIMARY KEY,
    officer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    original_officer_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    assignment_type VARCHAR(20) NOT NULL DEFAULT 'PERMANENT',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by_admin_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    ended_by_admin_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT officer_assignment_type_check
        CHECK (assignment_type IN ('PERMANENT', 'TEMPORARY')),
    CONSTRAINT officer_assignment_status_check
        CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELLED')),
    CONSTRAINT officer_assignment_reason_check CHECK (BTRIM(reason) <> ''),
    CONSTRAINT officer_assignment_time_check CHECK (ends_at IS NULL OR ends_at > starts_at),
    CONSTRAINT officer_assignment_original_check CHECK (
        (assignment_type = 'PERMANENT' AND original_officer_user_id IS NULL)
        OR
        (assignment_type = 'TEMPORARY' AND original_officer_user_id IS NOT NULL
            AND original_officer_user_id <> officer_user_id)
    )
);

CREATE UNIQUE INDEX uq_active_permanent_officer_department
    ON officer_department_assignments(officer_user_id, department_id)
    WHERE assignment_type = 'PERMANENT' AND status = 'ACTIVE';

CREATE INDEX idx_officer_assignment_department_active
    ON officer_department_assignments(department_id, status, starts_at, ends_at);

CREATE INDEX idx_officer_assignment_original
    ON officer_department_assignments(original_officer_user_id, department_id, status)
    WHERE original_officer_user_id IS NOT NULL;

-- Seed the new history model from existing accountable profile mappings.
INSERT INTO officer_department_assignments
    (officer_user_id, department_id, assignment_type, starts_at, reason, status, created_by_admin_id)
SELECT mapped.user_id, mapped.department_id, 'PERMANENT', mapped.created_at,
       'Migrated existing department responsibility', 'ACTIVE', admin_user.id
FROM (
    SELECT user_id, department_id, created_at FROM department_heads
    UNION ALL
    SELECT user_id, department_id, created_at FROM staff_profiles WHERE department_id IS NOT NULL
) mapped
CROSS JOIN LATERAL (
    SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1
) admin_user
ON CONFLICT (officer_user_id, department_id)
    WHERE assignment_type = 'PERMANENT' AND status = 'ACTIVE'
DO NOTHING;

INSERT INTO officer_availability
    (officer_user_id, availability_status, reason, updated_by_admin_id)
SELECT assignment.officer_user_id, 'AVAILABLE', NULL, admin_user.id
FROM (SELECT DISTINCT officer_user_id FROM officer_department_assignments) assignment
CROSS JOIN LATERAL (
    SELECT id FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1
) admin_user
ON CONFLICT (officer_user_id) DO NOTHING;

ALTER TABLE community_service_sessions
    ADD COLUMN supervising_officer_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    ADD COLUMN time_out_supervising_officer_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;

UPDATE community_service_sessions
SET supervising_officer_user_id = time_in_by_user_id,
    time_out_supervising_officer_user_id = time_out_by_user_id
WHERE supervising_officer_user_id IS NULL;

ALTER TABLE community_service_sessions
    ALTER COLUMN supervising_officer_user_id SET NOT NULL;

CREATE TABLE community_service_session_officer_history (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES community_service_sessions(id) ON DELETE CASCADE,
    officer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    officer_assignment_id BIGINT REFERENCES officer_department_assignments(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ends_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    changed_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT session_officer_history_time_check CHECK (ends_at IS NULL OR ends_at >= starts_at),
    CONSTRAINT session_officer_history_reason_check CHECK (BTRIM(reason) <> '')
);

CREATE UNIQUE INDEX uq_session_current_supervising_officer
    ON community_service_session_officer_history(session_id)
    WHERE ends_at IS NULL;

INSERT INTO community_service_session_officer_history
    (session_id, officer_user_id, starts_at, ends_at, reason, changed_by_user_id)
SELECT id, supervising_officer_user_id, time_in, time_out,
       'Migrated original supervising officer', time_in_by_user_id
FROM community_service_sessions
ON CONFLICT (session_id) WHERE ends_at IS NULL DO NOTHING;

ALTER TABLE notifications
    ADD COLUMN category VARCHAR(30),
    ADD COLUMN resource_type VARCHAR(50),
    ADD COLUMN resource_id BIGINT,
    ADD COLUMN link_path TEXT,
    ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE notifications
SET category = CASE
    WHEN notification_type LIKE 'SERVICE_%' THEN 'COMMUNITY_SERVICE'
    WHEN notification_type LIKE 'VIOLATION_%' THEN 'VIOLATIONS'
    WHEN notification_type LIKE 'CLEARANCE_%' THEN 'CLEARANCE'
    WHEN notification_type LIKE 'MESSAGE_%' THEN 'MESSAGES'
    ELSE 'SYSTEM'
END
WHERE category IS NULL;

ALTER TABLE notifications
    ALTER COLUMN category SET DEFAULT 'SYSTEM',
    ALTER COLUMN category SET NOT NULL,
    ADD CONSTRAINT notification_category_check CHECK (
        category IN ('MESSAGES', 'ATTENDANCE', 'VIOLATIONS', 'COMMUNITY_SERVICE', 'CLEARANCE', 'SYSTEM')
    );

CREATE INDEX idx_notifications_user_category_time
    ON notifications(user_id, category, created_at DESC, id DESC);
