-- Google-authenticated department officers request access without receiving
-- portal permissions until an administrator verifies and assigns a department.

CREATE TABLE google_department_registrations (
    id BIGSERIAL PRIMARY KEY,
    google_subject VARCHAR(255) NOT NULL,
    google_email VARCHAR(255) NOT NULL,
    officer_first_name VARCHAR(100) NOT NULL,
    officer_last_name VARCHAR(100) NOT NULL,
    employee_number VARCHAR(50),
    requested_department_type VARCHAR(30) NOT NULL,
    requested_department_name VARCHAR(150) NOT NULL,
    applicant_note VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    assigned_department_id BIGINT REFERENCES departments(id) ON DELETE RESTRICT,
    review_reason VARCHAR(1000),
    reviewed_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT google_department_registration_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT google_department_registration_type_check
        CHECK (requested_department_type IN ('LIBRARY', 'SCHOOL_GUARD', 'STAFF_OFFICE', 'OTHER')),
    CONSTRAINT google_department_registration_subject_not_blank CHECK (BTRIM(google_subject) <> ''),
    CONSTRAINT google_department_registration_email_not_blank CHECK (BTRIM(google_email) <> ''),
    CONSTRAINT google_department_registration_name_not_blank CHECK (
        BTRIM(officer_first_name) <> '' AND BTRIM(officer_last_name) <> '' AND BTRIM(requested_department_name) <> ''
    ),
    CONSTRAINT google_department_registration_review_state_check CHECK (
        (status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL AND assigned_department_id IS NULL)
        OR (status = 'REJECTED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND assigned_department_id IS NULL)
        OR (status = 'APPROVED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND assigned_department_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_google_department_registration_pending_subject
    ON google_department_registrations (google_subject) WHERE status = 'PENDING';

CREATE UNIQUE INDEX uq_google_department_registration_pending_employee
    ON google_department_registrations (employee_number)
    WHERE status = 'PENDING' AND employee_number IS NOT NULL;

CREATE INDEX idx_google_department_registration_review_queue
    ON google_department_registrations (status, created_at, id);
