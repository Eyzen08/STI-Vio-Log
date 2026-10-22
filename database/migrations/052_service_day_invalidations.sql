CREATE TABLE community_service_day_invalidations (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES community_service_assignments(id) ON DELETE RESTRICT,
    service_date DATE NOT NULL,
    performed_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    performed_by_role TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 500),
    removed_credit_minutes NUMERIC(16,6) NOT NULL CHECK (removed_credit_minutes >= 0),
    previous_completed_hours NUMERIC(12,6) NOT NULL CHECK (previous_completed_hours >= 0),
    new_completed_hours NUMERIC(12,6) NOT NULL CHECK (new_completed_hours >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (assignment_id, service_date)
);

CREATE TRIGGER service_day_invalidations_append_only
    BEFORE UPDATE OR DELETE ON community_service_day_invalidations
    FOR EACH ROW EXECUTE FUNCTION prevent_service_hour_correction_changes();

ALTER TABLE community_service_sessions
    ADD COLUMN day_invalidation_id BIGINT REFERENCES community_service_day_invalidations(id) ON DELETE RESTRICT,
    ADD COLUMN original_credited_minutes NUMERIC(16,6),
    ADD COLUMN invalidated_allowance_minutes NUMERIC(16,6),
    ADD CONSTRAINT service_session_invalidation_check CHECK (
        (day_invalidation_id IS NULL AND original_credited_minutes IS NULL AND invalidated_allowance_minutes IS NULL)
        OR (day_invalidation_id IS NOT NULL AND time_out IS NOT NULL AND credited_minutes=0
            AND original_credited_minutes IS NOT NULL AND original_credited_minutes>=0
            AND invalidated_allowance_minutes IS NOT NULL AND invalidated_allowance_minutes>=0)),
    DROP CONSTRAINT service_session_completion_reason_check,
    ADD CONSTRAINT service_session_completion_reason_check CHECK (
        completion_reason IS NULL OR completion_reason IN ('COMPLETED','EARLY_TIME_OUT','DAILY_LIMIT_REACHED','DAY_ENDED','DAY_INVALIDATED')),
    DROP CONSTRAINT community_service_session_condition_check,
    ADD CONSTRAINT community_service_session_condition_check CHECK (
        service_condition IS NULL OR service_condition IN ('SATISFACTORY','NEEDS_FOLLOW_UP','INCIDENT_REPORTED',
            'TODAYS_SERVICE_COMPLETED','LEFT_EARLY','SERVICE_COMPLETED','DAY_INVALIDATED'));
CREATE INDEX idx_service_sessions_invalidation ON community_service_sessions(day_invalidation_id) WHERE day_invalidation_id IS NOT NULL;

ALTER TABLE community_service_day_invalidations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON community_service_day_invalidations FROM PUBLIC;
REVOKE ALL ON SEQUENCE community_service_day_invalidations_id_seq FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
            EXECUTE format('REVOKE ALL ON community_service_day_invalidations FROM %I',role_name);
            EXECUTE format('REVOKE ALL ON SEQUENCE community_service_day_invalidations_id_seq FROM %I',role_name);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sti_vio_log_runtime') THEN
        GRANT SELECT,INSERT ON community_service_day_invalidations TO sti_vio_log_runtime;
        GRANT USAGE,SELECT ON SEQUENCE community_service_day_invalidations_id_seq TO sti_vio_log_runtime;
        CREATE POLICY sti_vio_log_runtime_access ON community_service_day_invalidations
            FOR ALL TO sti_vio_log_runtime USING (true) WITH CHECK (true);
    END IF;
END $$;
