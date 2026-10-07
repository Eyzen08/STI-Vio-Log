-- Keep historical evidence, while adding student-wide concurrency and daily rules.
ALTER TABLE community_service_assignments
    ALTER COLUMN required_hours TYPE NUMERIC(12,6),
    ALTER COLUMN completed_hours TYPE NUMERIC(12,6),
    ALTER COLUMN remaining_hours TYPE NUMERIC(12,6);
ALTER TABLE violations
    ALTER COLUMN required_service_hours TYPE NUMERIC(12,6),
    ALTER COLUMN completed_service_hours TYPE NUMERIC(12,6);
ALTER TABLE community_service_progress_history
    ALTER COLUMN previous_completed_minutes TYPE NUMERIC(16,6),
    ALTER COLUMN credited_minutes TYPE NUMERIC(16,6),
    ALTER COLUMN new_completed_minutes TYPE NUMERIC(16,6);
ALTER TABLE community_service_sessions
    ALTER COLUMN credited_minutes TYPE NUMERIC(16,6),
    ADD COLUMN student_id BIGINT REFERENCES students(id),
    ADD COLUMN session_type TEXT,
    ADD COLUMN selected_duration_minutes NUMERIC(12,6),
    ADD COLUMN service_date DATE,
    ADD COLUMN credit_cutoff_at TIMESTAMPTZ,
    ADD COLUMN completion_reason TEXT,
    ADD COLUMN time_in_role TEXT,
    ADD COLUMN time_out_role TEXT;

UPDATE community_service_sessions css SET student_id=a.student_id,
    service_date=(css.time_in AT TIME ZONE 'Asia/Manila')::date
FROM community_service_assignments a WHERE a.id=css.assignment_id;
UPDATE community_service_sessions css SET time_in_role=u.role::text
FROM users u WHERE u.id=css.time_in_by_user_id;
ALTER TABLE community_service_hour_corrections
    ALTER COLUMN previous_completed_hours TYPE NUMERIC(12,6),
    ALTER COLUMN new_completed_hours TYPE NUMERIC(12,6);
UPDATE community_service_sessions css SET time_out_role=u.role::text
FROM users u WHERE u.id=css.time_out_by_user_id;

DO $$
DECLARE conflicts TEXT;
BEGIN
    SELECT string_agg(student_id::text || ': sessions ' || sessions, '; ') INTO conflicts
    FROM (SELECT student_id,string_agg(id::text,', ' ORDER BY id) sessions
          FROM community_service_sessions WHERE time_out IS NULL
          GROUP BY student_id HAVING COUNT(*)>1) duplicates;
    IF conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Resolve duplicate active student sessions before migration: %', conflicts;
    END IF;
END $$;

UPDATE community_service_sessions css SET session_type='OPEN_TIME',
    credit_cutoff_at=LEAST(
        ((css.service_date+1)::timestamp AT TIME ZONE 'Asia/Manila'),
        css.time_in + (LEAST(a.remaining_hours*60,GREATEST(480-COALESCE((
            SELECT SUM(other.credited_minutes) FROM community_service_sessions other
            WHERE other.student_id=css.student_id AND other.service_date=css.service_date
              AND other.time_out IS NOT NULL
        ),0),0)) * INTERVAL '1 minute'))
FROM community_service_assignments a WHERE a.id=css.assignment_id AND css.time_out IS NULL;

ALTER TABLE community_service_sessions
    ALTER COLUMN student_id SET NOT NULL,
    ALTER COLUMN service_date SET NOT NULL,
    ADD CONSTRAINT service_session_duration_check CHECK (
        (session_type IS NULL AND selected_duration_minutes IS NULL AND time_out IS NOT NULL)
        OR (session_type IS NOT NULL AND session_type='OPEN_TIME' AND selected_duration_minutes IS NULL AND credit_cutoff_at IS NOT NULL)
        OR (session_type IS NOT NULL AND session_type='FIXED' AND selected_duration_minutes IS NOT NULL AND selected_duration_minutes>0 AND selected_duration_minutes<=480 AND credit_cutoff_at IS NOT NULL)),
    ADD CONSTRAINT service_session_completion_reason_check CHECK (completion_reason IS NULL OR completion_reason IN ('COMPLETED','EARLY_TIME_OUT','DAILY_LIMIT_REACHED','DAY_ENDED'));
CREATE UNIQUE INDEX uq_service_active_student ON community_service_sessions(student_id) WHERE time_out IS NULL;
CREATE INDEX idx_service_student_day ON community_service_sessions(student_id,service_date);
