ALTER TABLE google_student_registrations
    ADD COLUMN enrollment_academic_year VARCHAR(20),
    ADD COLUMN enrollment_semester VARCHAR(50),
    ADD COLUMN verification_method VARCHAR(30),
    ADD COLUMN verification_reference VARCHAR(200),
    ADD CONSTRAINT google_student_enrollment_verification_method_check
        CHECK (verification_method IS NULL OR verification_method IN ('REGISTRAR_RECORD', 'SIS', 'ENROLLMENT_LIST', 'OTHER')),
    ADD CONSTRAINT google_student_enrollment_verification_state_check CHECK (
        status <> 'APPROVED' OR (
            NULLIF(BTRIM(enrollment_academic_year), '') IS NOT NULL
            AND NULLIF(BTRIM(enrollment_semester), '') IS NOT NULL
            AND verification_method IS NOT NULL
            AND NULLIF(BTRIM(verification_reference), '') IS NOT NULL
        )
    ) NOT VALID;
