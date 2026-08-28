ALTER TABLE google_student_registrations
    ADD COLUMN phone_number VARCHAR(30),
    ADD COLUMN program VARCHAR(150),
    ADD COLUMN section VARCHAR(100),
    ADD COLUMN year_level INT,
    ADD COLUMN guardian_name VARCHAR(200),
    ADD COLUMN guardian_relationship VARCHAR(100),
    ADD COLUMN guardian_phone_number VARCHAR(30),
    ADD CONSTRAINT google_student_registration_year_level_check
        CHECK (year_level BETWEEN 1 AND 6);

