ALTER TABLE students ADD COLUMN strand VARCHAR(10) CHECK (strand IS NULL OR strand IN ('ABM','STEM'));
ALTER TABLE student_account_registrations
 ADD COLUMN academic_level VARCHAR(30) CHECK (academic_level IS NULL OR academic_level IN ('COLLEGE','SENIOR_HIGH_SCHOOL')),
 ADD COLUMN strand VARCHAR(10) CHECK (strand IS NULL OR strand IN ('ABM','STEM'));
ALTER TABLE google_student_registrations
 ADD COLUMN academic_level VARCHAR(30) CHECK (academic_level IS NULL OR academic_level IN ('COLLEGE','SENIOR_HIGH_SCHOOL')),
 ADD COLUMN strand VARCHAR(10) CHECK (strand IS NULL OR strand IN ('ABM','STEM'));
UPDATE students SET academic_level=CASE WHEN year_level IN (11,12) THEN 'SENIOR_HIGH_SCHOOL' WHEN year_level BETWEEN 1 AND 8 THEN 'COLLEGE' END WHERE academic_level IS NULL;
UPDATE student_account_registrations SET academic_level=CASE WHEN year_level IN (11,12) THEN 'SENIOR_HIGH_SCHOOL' WHEN year_level BETWEEN 1 AND 8 THEN 'COLLEGE' END WHERE academic_level IS NULL;
UPDATE google_student_registrations SET academic_level=CASE WHEN year_level IN (11,12) THEN 'SENIOR_HIGH_SCHOOL' WHEN year_level BETWEEN 1 AND 8 THEN 'COLLEGE' END WHERE academic_level IS NULL;
ALTER TABLE student_account_registrations DROP CONSTRAINT student_account_registration_year_level_check;
ALTER TABLE student_account_registrations ADD CONSTRAINT student_account_registration_year_level_check CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 8 OR year_level IN (11,12));
ALTER TABLE google_student_registrations DROP CONSTRAINT google_student_registration_year_level_check;
ALTER TABLE google_student_registrations ADD CONSTRAINT google_student_registration_year_level_check CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 8 OR year_level IN (11,12));
