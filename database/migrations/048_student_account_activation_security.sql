ALTER TABLE users ADD COLUMN temporary_password_expires_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN google_rebind_required BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing temporary student credentials get a full activation window on upgrade.
UPDATE users SET temporary_password_expires_at=CURRENT_TIMESTAMP+INTERVAL '24 hours'
WHERE role='STUDENT' AND must_change_password=TRUE;

-- An old confirmation of a different inbox cannot authorize the recorded Gmail.
UPDATE auth_otps SET used_at=CURRENT_TIMESTAMP
WHERE purpose='STUDENT_ONBOARDING_GOOGLE_EMAIL' AND used_at IS NULL
  AND user_id IN (SELECT user_id FROM students WHERE pending_google_email IS NOT NULL
    AND LOWER(pending_google_email) IS DISTINCT FROM LOWER(email));
UPDATE students SET pending_google_email=NULL,pending_google_email_verified_at=NULL
WHERE pending_google_email IS NOT NULL AND LOWER(pending_google_email) IS DISTINCT FROM LOWER(email);
