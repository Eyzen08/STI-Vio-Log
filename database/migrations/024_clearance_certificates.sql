CREATE TABLE discipline_officer_signatures (
    id BIGSERIAL PRIMARY KEY,
    officer_user_id BIGINT REFERENCES users(id),
    full_name VARCHAR(200) NOT NULL,
    position VARCHAR(120) NOT NULL DEFAULT 'Discipline Officer',
    image_data BYTEA NOT NULL,
    image_mime_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT NOT NULL REFERENCES users(id),
    updated_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT discipline_signature_image_type CHECK (image_mime_type IN ('image/png', 'image/jpeg'))
);

CREATE TABLE clearance_certificates (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id),
    clearance_id BIGINT NOT NULL REFERENCES student_clearance(id),
    certificate_number VARCHAR(80) NOT NULL UNIQUE,
    certificate_type VARCHAR(50) NOT NULL DEFAULT 'COMPLIANCE',
    version INTEGER NOT NULL,
    student_name VARCHAR(250) NOT NULL,
    student_number VARCHAR(50) NOT NULL,
    program VARCHAR(200) NOT NULL,
    completed_hours NUMERIC(8,2) NOT NULL,
    issue_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    pdf_data BYTEA NOT NULL,
    pdf_sha256 CHAR(64) NOT NULL,
    student_email VARCHAR(320),
    email_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    email_error VARCHAR(500),
    emailed_at TIMESTAMPTZ,
    issued_by BIGINT NOT NULL REFERENCES users(id),
    revoked_by BIGINT REFERENCES users(id),
    revoked_at TIMESTAMPTZ,
    revocation_reason VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT clearance_certificate_status CHECK (status IN ('ISSUED', 'REVOKED')),
    CONSTRAINT clearance_certificate_email_status CHECK (email_status IN ('PENDING', 'SENT', 'FAILED')),
    CONSTRAINT clearance_certificate_version_unique UNIQUE (student_id, version),
    CONSTRAINT clearance_certificate_hours_nonnegative CHECK (completed_hours >= 0),
    CONSTRAINT clearance_certificate_revocation_state CHECK (
        (status = 'ISSUED' AND revoked_by IS NULL AND revoked_at IS NULL AND revocation_reason IS NULL)
        OR (status = 'REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
    )
);

CREATE TABLE clearance_certificate_signatures (
    certificate_id BIGINT NOT NULL REFERENCES clearance_certificates(id),
    signature_id BIGINT NOT NULL REFERENCES discipline_officer_signatures(id),
    display_order SMALLINT NOT NULL,
    officer_name VARCHAR(200) NOT NULL,
    officer_position VARCHAR(120) NOT NULL,
    signature_image BYTEA NOT NULL,
    signature_mime_type VARCHAR(50) NOT NULL,
    PRIMARY KEY (certificate_id, signature_id),
    CONSTRAINT clearance_certificate_signature_order UNIQUE (certificate_id, display_order)
);

CREATE INDEX idx_clearance_certificates_student ON clearance_certificates(student_id, created_at DESC);
CREATE INDEX idx_clearance_certificates_status ON clearance_certificates(status, created_at DESC);
CREATE INDEX idx_discipline_signatures_active ON discipline_officer_signatures(is_active, full_name);
