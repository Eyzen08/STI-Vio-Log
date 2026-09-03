-- Verified recovery identity for primary administrator accounts.
CREATE TABLE admin_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT admin_profile_names_not_blank CHECK (BTRIM(first_name) <> '' AND BTRIM(last_name) <> '')
);

CREATE UNIQUE INDEX uq_admin_profiles_email
  ON admin_profiles(LOWER(email)) WHERE email IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE auth_otps DROP CONSTRAINT auth_otp_purpose_check;
ALTER TABLE auth_otps DROP CONSTRAINT auth_otp_owner_check;
ALTER TABLE auth_otps ADD CONSTRAINT auth_otp_purpose_check
  CHECK (purpose IN ('STUDENT_EMAIL_VERIFICATION','STUDENT_PASSWORD_RESET','ADMIN_EMAIL_VERIFICATION','ADMIN_PASSWORD_RESET'));
ALTER TABLE auth_otps ADD CONSTRAINT auth_otp_owner_check CHECK (
  (purpose = 'STUDENT_EMAIL_VERIFICATION' AND registration_id IS NOT NULL AND user_id IS NULL)
  OR (purpose IN ('STUDENT_PASSWORD_RESET','ADMIN_EMAIL_VERIFICATION','ADMIN_PASSWORD_RESET') AND user_id IS NOT NULL AND registration_id IS NULL)
);
