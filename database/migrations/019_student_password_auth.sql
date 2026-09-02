-- Student password registration, email verification, and password recovery.
-- Existing accounts remain verified so this additive migration preserves access.

ALTER TABLE users
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE student_account_registrations (
    id BIGSERIAL PRIMARY KEY,
    student_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(250) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMPTZ,
    CONSTRAINT student_account_registration_status_check
        CHECK (status IN ('PENDING', 'VERIFIED', 'EXPIRED', 'CANCELLED')),
    CONSTRAINT student_account_registration_identity_not_blank
        CHECK (BTRIM(student_number) <> '' AND BTRIM(full_name) <> '' AND BTRIM(email) <> '')
);

CREATE UNIQUE INDEX uq_student_account_registration_pending_number
    ON student_account_registrations (student_number)
    WHERE status = 'PENDING';

CREATE UNIQUE INDEX uq_student_account_registration_pending_email
    ON student_account_registrations (LOWER(email))
    WHERE status = 'PENDING';

CREATE TABLE auth_otps (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    registration_id BIGINT REFERENCES student_account_registrations(id) ON DELETE CASCADE,
    purpose VARCHAR(40) NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT auth_otp_purpose_check
        CHECK (purpose IN ('STUDENT_EMAIL_VERIFICATION', 'STUDENT_PASSWORD_RESET')),
    CONSTRAINT auth_otp_attempt_count_check CHECK (attempt_count >= 0),
    CONSTRAINT auth_otp_owner_check CHECK (
        (purpose = 'STUDENT_EMAIL_VERIFICATION' AND registration_id IS NOT NULL AND user_id IS NULL)
        OR
        (purpose = 'STUDENT_PASSWORD_RESET' AND user_id IS NOT NULL AND registration_id IS NULL)
    )
);

CREATE UNIQUE INDEX uq_auth_otp_active_registration
    ON auth_otps (registration_id, purpose)
    WHERE used_at IS NULL AND registration_id IS NOT NULL;

CREATE UNIQUE INDEX uq_auth_otp_active_user
    ON auth_otps (user_id, purpose)
    WHERE used_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX idx_auth_otps_expiration ON auth_otps (expires_at);

CREATE TABLE password_reset_authorizations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_authorizations_user
    ON password_reset_authorizations (user_id, expires_at DESC);

