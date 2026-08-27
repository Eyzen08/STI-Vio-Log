-- Google-authenticated applicants may request a student account, but they do
-- not receive a user or student record until an authorized reviewer approves
-- enrollment. Rejected attempts remain as immutable review history.

CREATE TABLE google_student_registrations (
    id BIGSERIAL PRIMARY KEY,
    google_subject VARCHAR(255) NOT NULL,
    google_email VARCHAR(255),
    student_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    review_reason VARCHAR(1000),
    reviewed_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT google_student_registration_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT google_student_registration_subject_not_blank
        CHECK (BTRIM(google_subject) <> ''),
    CONSTRAINT google_student_registration_student_number_not_blank
        CHECK (BTRIM(student_number) <> ''),
    CONSTRAINT google_student_registration_review_state_check CHECK (
        (status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR
        (status IN ('APPROVED', 'REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_google_student_registration_pending_subject
    ON google_student_registrations (google_subject)
    WHERE status = 'PENDING';

CREATE UNIQUE INDEX uq_google_student_registration_pending_number
    ON google_student_registrations (student_number)
    WHERE status = 'PENDING';

CREATE INDEX idx_google_student_registration_review_queue
    ON google_student_registrations (status, created_at, id);
