-- Preserve complete student and guardian information while email verification is pending.
ALTER TABLE student_account_registrations
    ADD COLUMN first_name VARCHAR(150),
    ADD COLUMN middle_name VARCHAR(150),
    ADD COLUMN last_name VARCHAR(150),
    ADD COLUMN suffix VARCHAR(50),
    ADD COLUMN phone_number VARCHAR(30),
    ADD COLUMN program VARCHAR(150),
    ADD COLUMN section VARCHAR(100),
    ADD COLUMN year_level INT,
    ADD COLUMN guardian_name VARCHAR(200),
    ADD COLUMN guardian_relationship VARCHAR(100),
    ADD COLUMN guardian_phone_number VARCHAR(30),
    ADD CONSTRAINT student_account_registration_year_level_check
        CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 6);
