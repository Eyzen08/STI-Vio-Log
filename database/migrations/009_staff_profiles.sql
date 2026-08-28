-- Individually attributable profiles for non-student, non-department staff.
CREATE TABLE staff_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_number VARCHAR(50) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT staff_profile_names_not_blank CHECK (BTRIM(first_name) <> '' AND BTRIM(last_name) <> '')
);

CREATE INDEX idx_staff_profiles_name ON staff_profiles (last_name, first_name, id);
