-- Separate technical maintenance authority from disciplinary operations.
-- Existing ADMIN accounts are operational accounts and retain their IDs/history.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SYSTEM_ADMIN';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DISCIPLINE_ADMIN';

-- PostgreSQL requires newly added enum values to be committed before use.
-- Account conversion therefore occurs in the next separately committed migration.
