-- Google identities are linked only to existing local users. Authentication
-- code must use google_subject (the verified Google `sub` claim), never email,
-- as the stable external identifier.

CREATE TABLE google_identity_links (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    google_subject VARCHAR(255) NOT NULL,
    google_email VARCHAR(255),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    CONSTRAINT uq_google_identity_links_user UNIQUE (user_id),
    CONSTRAINT uq_google_identity_links_subject UNIQUE (google_subject),
    CONSTRAINT google_identity_subject_not_blank CHECK (BTRIM(google_subject) <> '')
);

CREATE INDEX idx_google_identity_links_last_login
    ON google_identity_links (last_login_at DESC);
