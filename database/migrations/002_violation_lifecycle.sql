-- Violation lifecycle statuses are intentionally separate from
-- community-service assignment statuses. The old violation_status enum
-- remains in use by community_service_assignments.

CREATE TYPE violation_lifecycle_status AS ENUM (
    'OPEN',
    'COMPLETE',
    'CLEAR',
    'INVALID_CANCEL'
);

ALTER TABLE violations
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE violations
    ALTER COLUMN status TYPE violation_lifecycle_status
    USING (
        CASE status::text
            WHEN 'OPEN' THEN 'OPEN'
            WHEN 'IN_PROGRESS' THEN 'OPEN'
            WHEN 'COMPLETED' THEN 'COMPLETE'
            WHEN 'CLEARED' THEN 'CLEAR'
        END
    )::violation_lifecycle_status;

ALTER TABLE violations
    ALTER COLUMN status SET DEFAULT 'OPEN'::violation_lifecycle_status;

CREATE TYPE violation_action_type AS ENUM (
    'CREATE',
    'COMPLETE',
    'CLEAR',
    'INVALID_CANCEL',
    'REOPEN'
);

CREATE TABLE violation_actions (
    id BIGSERIAL PRIMARY KEY,
    violation_id BIGINT NOT NULL
        REFERENCES violations(id) ON DELETE RESTRICT,
    action violation_action_type NOT NULL,
    from_status violation_lifecycle_status,
    to_status violation_lifecycle_status NOT NULL,
    reason VARCHAR(1000),
    performed_by_user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    performed_by_role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_violation_actions_violation_created
    ON violation_actions(violation_id, created_at, id);

CREATE INDEX idx_violation_actions_actor
    ON violation_actions(performed_by_user_id);

-- Preserve a structured CREATE event for violations that predate this
-- migration. Their original reporter is used where available; otherwise
-- the earliest active ADMIN account is used as the migration actor.
INSERT INTO violation_actions (
    violation_id,
    action,
    from_status,
    to_status,
    reason,
    performed_by_user_id,
    performed_by_role,
    created_at
)
SELECT
    v.id,
    'CREATE',
    NULL,
    v.status,
    'Historical violation imported during lifecycle migration',
    COALESCE(v.reported_by, fallback.id),
    actor.role,
    v.created_at
FROM violations v
CROSS JOIN LATERAL (
    SELECT id
    FROM users
    WHERE is_active = TRUE
    ORDER BY (role = 'ADMIN') DESC, id
    LIMIT 1
) fallback
JOIN users actor
    ON actor.id = COALESCE(v.reported_by, fallback.id);
