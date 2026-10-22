CREATE TABLE community_service_session_pauses (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES community_service_sessions(id),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    started_by_user_id BIGINT NOT NULL REFERENCES users(id),
    ended_by_user_id BIGINT REFERENCES users(id),
    reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
    CHECK ((ended_at IS NULL AND ended_by_user_id IS NULL)
        OR (ended_at IS NOT NULL AND ended_by_user_id IS NOT NULL AND ended_at >= started_at))
);
CREATE UNIQUE INDEX uq_service_session_open_pause
    ON community_service_session_pauses(session_id) WHERE ended_at IS NULL;
CREATE INDEX idx_service_session_pauses_history
    ON community_service_session_pauses(session_id, started_at, id);

ALTER TABLE community_service_session_pauses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_service_session_pauses FROM PUBLIC;
REVOKE ALL ON SEQUENCE community_service_session_pauses_id_seq FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
            EXECUTE format('REVOKE ALL ON community_service_session_pauses FROM %I',role_name);
            EXECUTE format('REVOKE ALL ON SEQUENCE community_service_session_pauses_id_seq FROM %I',role_name);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sti_vio_log_runtime') THEN
        GRANT SELECT,INSERT,UPDATE ON community_service_session_pauses TO sti_vio_log_runtime;
        GRANT USAGE,SELECT ON SEQUENCE community_service_session_pauses_id_seq TO sti_vio_log_runtime;
        CREATE POLICY sti_vio_log_runtime_access ON community_service_session_pauses
            FOR ALL TO sti_vio_log_runtime USING (true) WITH CHECK (true);
    END IF;
END;
$$;

UPDATE community_service_sessions
SET session_type='OPEN_TIME', selected_duration_minutes=NULL
WHERE time_out IS NULL;
