ALTER TABLE students
    DROP CONSTRAINT students_academic_level_check,
    ADD CONSTRAINT students_academic_level_check
        CHECK (academic_level IS NULL OR academic_level IN ('COLLEGE', 'SENIOR_HIGH_SCHOOL', 'TESDA')),
    DROP CONSTRAINT students_strand_check,
    ADD CONSTRAINT students_strand_check
        CHECK (strand IS NULL OR strand IN ('ABM', 'STEM', 'STEM-ETM', 'B&E'));

ALTER TABLE student_account_registrations
    DROP CONSTRAINT student_account_registrations_academic_level_check,
    ADD CONSTRAINT student_account_registrations_academic_level_check
        CHECK (academic_level IS NULL OR academic_level IN ('COLLEGE', 'SENIOR_HIGH_SCHOOL', 'TESDA')),
    DROP CONSTRAINT student_account_registrations_strand_check,
    ADD CONSTRAINT student_account_registrations_strand_check
        CHECK (strand IS NULL OR strand IN ('ABM', 'STEM', 'STEM-ETM', 'B&E'));

ALTER TABLE google_student_registrations
    DROP CONSTRAINT google_student_registrations_academic_level_check,
    ADD CONSTRAINT google_student_registrations_academic_level_check
        CHECK (academic_level IS NULL OR academic_level IN ('COLLEGE', 'SENIOR_HIGH_SCHOOL', 'TESDA')),
    DROP CONSTRAINT google_student_registrations_strand_check,
    ADD CONSTRAINT google_student_registrations_strand_check
        CHECK (strand IS NULL OR strand IN ('ABM', 'STEM', 'STEM-ETM', 'B&E'));
