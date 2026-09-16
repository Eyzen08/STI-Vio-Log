-- Balanced retention for short-lived authentication records and unverified
-- password-registration data. Official records and audit history are untouched.

ALTER TABLE student_account_registrations
    ADD COLUMN redacted_at TIMESTAMPTZ,
    ALTER COLUMN student_number DROP NOT NULL,
    ALTER COLUMN full_name DROP NOT NULL,
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE student_account_registrations
    ADD CONSTRAINT student_account_registration_redaction_state_check CHECK (
        (
            redacted_at IS NULL
            AND student_number IS NOT NULL AND BTRIM(student_number) <> ''
            AND full_name IS NOT NULL AND BTRIM(full_name) <> ''
            AND email IS NOT NULL AND BTRIM(email) <> ''
            AND (status <> 'PENDING' OR password_hash IS NOT NULL)
        )
        OR
        (
            redacted_at IS NOT NULL
            AND status IN ('VERIFIED', 'EXPIRED', 'CANCELLED')
            AND student_number IS NULL
            AND full_name IS NULL
            AND email IS NULL
            AND password_hash IS NULL
            AND first_name IS NULL
            AND middle_name IS NULL
            AND last_name IS NULL
            AND suffix IS NULL
            AND phone_number IS NULL
            AND program IS NULL
            AND section IS NULL
            AND year_level IS NULL
            AND guardian_name IS NULL
            AND guardian_relationship IS NULL
            AND guardian_phone_number IS NULL
        )
    );

CREATE INDEX idx_student_account_registration_retention
    ON student_account_registrations(status, updated_at)
    WHERE redacted_at IS NULL;

CREATE OR REPLACE FUNCTION cleanup_ephemeral_data() RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    expired_registrations INTEGER := 0;
    redacted_registrations INTEGER := 0;
    deleted_auth_otps INTEGER := 0;
    deleted_reset_authorizations INTEGER := 0;
    deleted_mfa_challenges INTEGER := 0;
    deleted_step_up_tokens INTEGER := 0;
    deleted_browser_sessions INTEGER := 0;
    deleted_authentication_throttles INTEGER := 0;
BEGIN
    UPDATE student_account_registrations
    SET status='EXPIRED', password_hash=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE status='PENDING'
      AND created_at<CURRENT_TIMESTAMP-INTERVAL '24 hours';
    GET DIAGNOSTICS expired_registrations = ROW_COUNT;

    UPDATE student_account_registrations
    SET student_number=NULL,
        full_name=NULL,
        email=NULL,
        password_hash=NULL,
        first_name=NULL,
        middle_name=NULL,
        last_name=NULL,
        suffix=NULL,
        phone_number=NULL,
        program=NULL,
        section=NULL,
        year_level=NULL,
        guardian_name=NULL,
        guardian_relationship=NULL,
        guardian_phone_number=NULL,
        redacted_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP
    WHERE status IN ('VERIFIED','EXPIRED','CANCELLED')
      AND redacted_at IS NULL
      AND updated_at<CURRENT_TIMESTAMP-INTERVAL '30 days';
    GET DIAGNOSTICS redacted_registrations = ROW_COUNT;

    DELETE FROM auth_otps
    WHERE expires_at<CURRENT_TIMESTAMP-INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_auth_otps = ROW_COUNT;

    DELETE FROM password_reset_authorizations
    WHERE expires_at<CURRENT_TIMESTAMP-INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_reset_authorizations = ROW_COUNT;

    DELETE FROM mfa_challenges
    WHERE expires_at<CURRENT_TIMESTAMP-INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_mfa_challenges = ROW_COUNT;

    DELETE FROM administrative_step_up_tokens
    WHERE expires_at<CURRENT_TIMESTAMP-INTERVAL '24 hours';
    GET DIAGNOSTICS deleted_step_up_tokens = ROW_COUNT;

    DELETE FROM browser_sessions
    WHERE (revoked_at IS NOT NULL AND revoked_at<CURRENT_TIMESTAMP-INTERVAL '30 days')
       OR absolute_expires_at<CURRENT_TIMESTAMP-INTERVAL '30 days';
    GET DIAGNOSTICS deleted_browser_sessions = ROW_COUNT;

    DELETE FROM authentication_throttles
    WHERE updated_at<CURRENT_TIMESTAMP-INTERVAL '30 days'
      AND (blocked_until IS NULL OR blocked_until<CURRENT_TIMESTAMP);
    GET DIAGNOSTICS deleted_authentication_throttles = ROW_COUNT;

    RETURN jsonb_build_object(
        'expired_registrations', expired_registrations,
        'redacted_registrations', redacted_registrations,
        'deleted_auth_otps', deleted_auth_otps,
        'deleted_reset_authorizations', deleted_reset_authorizations,
        'deleted_mfa_challenges', deleted_mfa_challenges,
        'deleted_step_up_tokens', deleted_step_up_tokens,
        'deleted_browser_sessions', deleted_browser_sessions,
        'deleted_authentication_throttles', deleted_authentication_throttles
    );
END;
$$;

DO $$
DECLARE
    schema_name TEXT := current_schema();
    role_name TEXT;
BEGIN
    EXECUTE format(
        'ALTER FUNCTION %I.cleanup_ephemeral_data() SET search_path = pg_catalog, %I',
        schema_name,
        schema_name
    );
    EXECUTE format('REVOKE ALL ON FUNCTION %I.cleanup_ephemeral_data() FROM PUBLIC', schema_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','sti_vio_log_runtime'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION %I.cleanup_ephemeral_data() FROM %I', schema_name, role_name);
        END IF;
    END LOOP;

    -- pg_cron jobs are database-global. Never install or schedule them while
    -- the migration integration tests are operating in isolated test schemas.
    IF schema_name='public' THEN
        EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
        EXECUTE $schedule$
            SELECT cron.schedule(
                'sti-vio-log-daily-maintenance',
                '0 18 * * *',
                'SELECT public.cleanup_ephemeral_data();'
            )
        $schedule$;
    END IF;
END;
$$;
