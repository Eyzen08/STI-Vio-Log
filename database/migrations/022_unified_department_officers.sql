-- Link Discipline Office staff profiles to the department created for them.
-- Department Head profiles already carry this relationship in department_heads.
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS department_type VARCHAR(50);

UPDATE departments SET department_type = department_code WHERE department_type IS NULL;

ALTER TABLE departments ALTER COLUMN department_type SET DEFAULT 'GENERAL';
ALTER TABLE departments ALTER COLUMN department_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_profiles_department_id
  ON staff_profiles(department_id);
