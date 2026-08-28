CREATE TABLE parent_contact_logs (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    guardian_id BIGINT NOT NULL REFERENCES student_guardians(id) ON DELETE RESTRICT,
    contacted_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    department_id BIGINT REFERENCES departments(id) ON DELETE RESTRICT,
    contact_method VARCHAR(20) NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT parent_contact_method_check CHECK (contact_method IN ('CALL', 'SMS', 'IN_PERSON', 'OTHER')),
    CONSTRAINT parent_contact_outcome_check CHECK (outcome IN ('REACHED', 'NO_ANSWER', 'LEFT_MESSAGE', 'FOLLOW_UP', 'OTHER'))
);

CREATE INDEX idx_parent_contact_student_time
    ON parent_contact_logs (student_id, created_at DESC, id DESC);

CREATE INDEX idx_parent_contact_department_time
    ON parent_contact_logs (department_id, created_at DESC, id DESC);

