CREATE TABLE community_service_hour_corrections (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL REFERENCES community_service_assignments(id) ON DELETE RESTRICT,
    previous_completed_hours NUMERIC(6,2) NOT NULL CHECK (previous_completed_hours >= 0),
    new_completed_hours NUMERIC(6,2) NOT NULL CHECK (new_completed_hours >= 0),
    performed_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason VARCHAR(1000) NOT NULL CHECK (length(trim(reason)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (previous_completed_hours <> new_completed_hours)
);

CREATE INDEX idx_service_hour_corrections_assignment
    ON community_service_hour_corrections (assignment_id, created_at, id);

CREATE FUNCTION prevent_service_hour_correction_changes() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'Service hour corrections are append-only';
END;
$$;

CREATE TRIGGER service_hour_corrections_append_only
    BEFORE UPDATE OR DELETE ON community_service_hour_corrections
    FOR EACH ROW EXECUTE FUNCTION prevent_service_hour_correction_changes();

ALTER TABLE community_service_hour_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE community_service_hour_corrections FROM PUBLIC;
REVOKE ALL ON FUNCTION prevent_service_hour_correction_changes() FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('REVOKE ALL ON TABLE community_service_hour_corrections FROM %I', role_name);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sti_vio_log_runtime') THEN
        REVOKE ALL ON TABLE community_service_hour_corrections FROM sti_vio_log_runtime;
        GRANT SELECT, INSERT ON community_service_hour_corrections TO sti_vio_log_runtime;
        GRANT USAGE, SELECT ON SEQUENCE community_service_hour_corrections_id_seq TO sti_vio_log_runtime;
        CREATE POLICY sti_vio_log_runtime_access ON community_service_hour_corrections
            FOR ALL TO sti_vio_log_runtime USING (true) WITH CHECK (true);
    END IF;
END $$;
