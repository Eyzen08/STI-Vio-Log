-- Mandatory onboarding applies only to student accounts provisioned after this migration.
ALTER TABLE students
    ADD COLUMN onboarding_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX idx_students_onboarding_required
    ON students (user_id)
    WHERE onboarding_required = TRUE AND onboarding_completed_at IS NULL;

