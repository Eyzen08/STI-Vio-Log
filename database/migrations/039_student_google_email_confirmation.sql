ALTER TABLE students
    ADD COLUMN pending_google_email VARCHAR(255),
    ADD COLUMN pending_google_email_verified_at TIMESTAMPTZ,
    ADD CONSTRAINT student_pending_google_email_state_check CHECK (
        pending_google_email_verified_at IS NULL OR pending_google_email IS NOT NULL
    );

ALTER TABLE auth_otps
    ADD COLUMN target_email VARCHAR(255);

ALTER TABLE auth_otps DROP CONSTRAINT auth_otp_purpose_check;
ALTER TABLE auth_otps DROP CONSTRAINT auth_otp_owner_check;

ALTER TABLE auth_otps ADD CONSTRAINT auth_otp_purpose_check CHECK (
    purpose IN (
        'STUDENT_EMAIL_VERIFICATION',
        'STUDENT_PASSWORD_RESET',
        'ADMIN_EMAIL_VERIFICATION',
        'ADMIN_PASSWORD_RESET',
        'STUDENT_ONBOARDING_GOOGLE_EMAIL'
    )
);

ALTER TABLE auth_otps ADD CONSTRAINT auth_otp_owner_check CHECK (
    (purpose = 'STUDENT_EMAIL_VERIFICATION' AND registration_id IS NOT NULL AND user_id IS NULL)
    OR (purpose IN (
        'STUDENT_PASSWORD_RESET',
        'ADMIN_EMAIL_VERIFICATION',
        'ADMIN_PASSWORD_RESET',
        'STUDENT_ONBOARDING_GOOGLE_EMAIL'
    ) AND user_id IS NOT NULL AND registration_id IS NULL)
);

CREATE INDEX idx_students_pending_google_email
    ON students (user_id)
    WHERE pending_google_email IS NOT NULL AND onboarding_required = TRUE;
