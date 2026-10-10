CREATE TABLE terms_acknowledgments (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    acknowledgment_version TEXT NOT NULL CHECK (BTRIM(acknowledgment_version) <> ''),
    terms_version TEXT NOT NULL CHECK (BTRIM(terms_version) <> ''),
    privacy_notice_version TEXT NOT NULL CHECK (BTRIM(privacy_notice_version) <> ''),
    terms_hash TEXT NOT NULL CHECK (terms_hash ~ '^[a-f0-9]{64}$'),
    privacy_notice_hash TEXT NOT NULL CHECK (privacy_notice_hash ~ '^[a-f0-9]{64}$'),
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, acknowledgment_version)
);

ALTER TABLE terms_acknowledgments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON terms_acknowledgments FROM PUBLIC;

DO $$
DECLARE role_name TEXT;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('REVOKE ALL ON terms_acknowledgments FROM %I', role_name);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sti_vio_log_runtime') THEN
        REVOKE ALL ON terms_acknowledgments FROM sti_vio_log_runtime;
        GRANT SELECT, INSERT ON terms_acknowledgments TO sti_vio_log_runtime;
        CREATE POLICY runtime_acknowledgment_read ON terms_acknowledgments
            FOR SELECT TO sti_vio_log_runtime USING (true);
        CREATE POLICY runtime_acknowledgment_insert ON terms_acknowledgments
            FOR INSERT TO sti_vio_log_runtime WITH CHECK (true);
    END IF;
END;
$$;
