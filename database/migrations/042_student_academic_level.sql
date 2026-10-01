ALTER TABLE students
    ADD COLUMN academic_level VARCHAR(30),
    ADD CONSTRAINT students_academic_level_check
        CHECK (academic_level IS NULL OR academic_level IN ('COLLEGE', 'SENIOR_HIGH_SCHOOL'));