-- Opaque browser sessions and mandatory MFA foundations for privileged roles.
CREATE TABLE browser_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    csrf_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    idle_expires_at TIMESTAMPTZ NOT NULL,
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    ip_address INET,
    user_agent VARCHAR(500),
    CONSTRAINT browser_session_expiry CHECK (idle_expires_at <= absolute_expires_at)
);
CREATE INDEX idx_browser_sessions_active ON browser_sessions(token_hash, absolute_expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_browser_sessions_user ON browser_sessions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION revoke_sessions_on_account_security_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF NEW.session_version IS DISTINCT FROM OLD.session_version OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE browser_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_revoke_browser_sessions
AFTER UPDATE OF session_version,is_active ON users
FOR EACH ROW EXECUTE FUNCTION revoke_sessions_on_account_security_change();

CREATE TABLE user_mfa (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    encrypted_secret TEXT NOT NULL,
    enabled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mfa_recovery_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_mfa_recovery_active ON mfa_recovery_codes(user_id) WHERE used_at IS NULL;

CREATE TABLE mfa_challenges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('ENROLL','VERIFY')),
    expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_mfa_challenge_active ON mfa_challenges(token_hash, expires_at) WHERE consumed_at IS NULL;

CREATE TABLE authentication_throttles (
    throttle_key CHAR(64) PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    blocked_until TIMESTAMPTZ,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

REVOKE ALL ON browser_sessions, user_mfa, mfa_recovery_codes, mfa_challenges, authentication_throttles FROM PUBLIC;

-- A non-login group for the backend's dedicated runtime login. Create the
-- actual LOGIN role and password out-of-band, then grant it this group.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sti_vio_log_runtime') THEN
    CREATE ROLE sti_vio_log_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- STI Vio-Log uses its server API rather than Supabase's public Data API.
-- Remove accidental PostgREST access while retaining the server connection.
DO $$
DECLARE role_name TEXT; table_name TEXT; schema_name TEXT := current_schema();
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname=schema_name LOOP
        EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I',schema_name,table_name,role_name);
      END LOOP;
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I',schema_name,role_name);
    END IF;
  END LOOP;
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname=schema_name LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',schema_name,table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM sti_vio_log_runtime',schema_name,table_name);
    IF table_name IN ('audit_logs','security_audit_events') THEN
      EXECUTE format('GRANT SELECT,INSERT ON TABLE %I.%I TO sti_vio_log_runtime',schema_name,table_name);
    ELSE
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE %I.%I TO sti_vio_log_runtime',schema_name,table_name);
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS sti_vio_log_runtime_access ON %I.%I',schema_name,table_name);
    EXECUTE format('CREATE POLICY sti_vio_log_runtime_access ON %I.%I FOR ALL TO sti_vio_log_runtime USING (true) WITH CHECK (true)',schema_name,table_name);
  END LOOP;
  EXECUTE format('GRANT USAGE ON SCHEMA %I TO sti_vio_log_runtime',schema_name);
  EXECUTE format('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA %I TO sti_vio_log_runtime',schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC',schema_name);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM PUBLIC',schema_name);
END $$;
