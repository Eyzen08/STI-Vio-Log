-- Keep the Google registration review projection aligned with the complete
-- student identity used by the manual registration workflow.

ALTER TABLE google_student_registrations
    ADD COLUMN middle_name VARCHAR(100),
    ADD COLUMN suffix VARCHAR(30);
