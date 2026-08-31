-- Student portal access is reviewed by the Discipline Office against its own
-- student records. Enrollment/Registrar evidence is outside this system's
-- scope, so approval no longer depends on academic-period or source fields.

ALTER TABLE google_student_registrations
    DROP CONSTRAINT IF EXISTS google_student_enrollment_verification_state_check;
