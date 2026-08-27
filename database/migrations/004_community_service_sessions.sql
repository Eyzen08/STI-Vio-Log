-- Dedicated, authoritative DTR sessions. Existing attendance event rows remain
-- untouched and continue to be written as a compatibility/audit feed.

CREATE TABLE community_service_sessions (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL
        REFERENCES community_service_assignments(id),
    department_id BIGINT NOT NULL
        REFERENCES departments(id),
    time_in TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    time_out TIMESTAMPTZ,
    worked_minutes INTEGER,
    credited_minutes INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    time_in_by_user_id BIGINT NOT NULL REFERENCES users(id),
    time_out_by_user_id BIGINT REFERENCES users(id),
    time_in_attendance_id BIGINT REFERENCES community_service_attendance(id),
    time_out_attendance_id BIGINT REFERENCES community_service_attendance(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_service_session_status_check
        CHECK (status IN ('ACTIVE', 'COMPLETED')),
    CONSTRAINT community_service_session_state_check CHECK (
        (status = 'ACTIVE' AND time_out IS NULL AND worked_minutes IS NULL
            AND credited_minutes IS NULL AND time_out_by_user_id IS NULL)
        OR
        (status = 'COMPLETED' AND time_out IS NOT NULL AND worked_minutes >= 0
            AND credited_minutes >= 0 AND credited_minutes <= worked_minutes
            AND time_out_by_user_id IS NOT NULL)
    ),
    CONSTRAINT community_service_session_time_order_check
        CHECK (time_out IS NULL OR time_out >= time_in)
);

-- This is the concurrency source of truth. Even simultaneous application
-- requests cannot create two open sessions for one assignment.
CREATE UNIQUE INDEX uq_community_service_active_session
    ON community_service_sessions (assignment_id)
    WHERE time_out IS NULL;

CREATE INDEX idx_service_sessions_assignment_time
    ON community_service_sessions (assignment_id, time_in DESC);

CREATE INDEX idx_service_sessions_department_time
    ON community_service_sessions (department_id, time_in DESC);

CREATE TABLE community_service_progress_history (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL
        REFERENCES community_service_assignments(id),
    session_id BIGINT NOT NULL UNIQUE
        REFERENCES community_service_sessions(id),
    previous_completed_minutes INTEGER NOT NULL,
    worked_minutes INTEGER NOT NULL,
    credited_minutes INTEGER NOT NULL,
    new_completed_minutes INTEGER NOT NULL,
    action VARCHAR(30) NOT NULL DEFAULT 'SESSION_CREDIT',
    performed_by_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT community_service_progress_values_check CHECK (
        previous_completed_minutes >= 0 AND worked_minutes >= 0
        AND credited_minutes >= 0 AND credited_minutes <= worked_minutes
        AND new_completed_minutes = previous_completed_minutes + credited_minutes
    ),
    CONSTRAINT community_service_progress_action_check
        CHECK (action IN ('SESSION_CREDIT'))
);

CREATE INDEX idx_service_progress_assignment
    ON community_service_progress_history (assignment_id, created_at, id);
