ALTER TABLE users
    ADD COLUMN avatar_source TEXT NOT NULL DEFAULT 'INITIALS'
        CHECK (avatar_source IN ('INITIALS', 'PRESET', 'PHOTO')),
    ADD COLUMN avatar_preset_id TEXT
        CHECK (avatar_preset_id ~ '^portrait-(0[1-9]|[1-3][0-9]|4[0-8])$'),
    ADD COLUMN avatar_photo_revision UUID,
    ADD CONSTRAINT avatar_preset_required CHECK (avatar_source <> 'PRESET' OR avatar_preset_id IS NOT NULL),
    ADD CONSTRAINT avatar_photo_required CHECK (avatar_source <> 'PHOTO' OR avatar_photo_revision IS NOT NULL);

CREATE TABLE user_avatar_photos (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    image_data BYTEA NOT NULL CHECK (octet_length(image_data) BETWEEN 1 AND 1048576),
    image_mime_type TEXT NOT NULL CHECK (image_mime_type IN ('image/png', 'image/jpeg')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_avatar_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_avatar_photos FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
            EXECUTE format('REVOKE ALL ON TABLE user_avatar_photos FROM %I', role_name);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sti_vio_log_runtime') THEN
        GRANT SELECT,INSERT,UPDATE,DELETE ON user_avatar_photos TO sti_vio_log_runtime;
        CREATE POLICY sti_vio_log_runtime_access ON user_avatar_photos
            FOR ALL TO sti_vio_log_runtime USING (true) WITH CHECK (true);
    END IF;
END $$;
