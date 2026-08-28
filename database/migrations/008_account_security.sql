-- Session invalidation, forced credential rotation, and history-preserving
-- Google-link recovery foundations for account administration.

ALTER TABLE users
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN password_changed_at TIMESTAMPTZ,
    ADD COLUMN deactivated_at TIMESTAMPTZ,
    ADD COLUMN deactivated_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT users_session_version_positive CHECK (session_version > 0);

UPDATE users SET deactivated_at = COALESCE(updated_at, CURRENT_TIMESTAMP) WHERE is_active = FALSE;

ALTER TABLE users ADD CONSTRAINT users_deactivation_state_check CHECK (
        (is_active = TRUE AND deactivated_at IS NULL AND deactivated_by IS NULL)
        OR (is_active = FALSE AND deactivated_at IS NOT NULL)
    );

ALTER TABLE google_identity_links
    ADD COLUMN revoked_at TIMESTAMPTZ,
    ADD COLUMN revoked_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    ADD COLUMN revocation_reason TEXT,
    ADD CONSTRAINT google_identity_revocation_state_check CHECK (
        (revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
        OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND BTRIM(revocation_reason) <> '')
    );

ALTER TABLE google_identity_links DROP CONSTRAINT uq_google_identity_links_user;
ALTER TABLE google_identity_links DROP CONSTRAINT uq_google_identity_links_subject;

CREATE UNIQUE INDEX uq_google_identity_links_active_user
    ON google_identity_links (user_id) WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX uq_google_identity_links_active_subject
    ON google_identity_links (google_subject) WHERE revoked_at IS NULL;

CREATE INDEX idx_google_identity_links_revoked
    ON google_identity_links (revoked_at DESC) WHERE revoked_at IS NOT NULL;
