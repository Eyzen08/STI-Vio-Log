ALTER TABLE community_service_sessions
    DROP CONSTRAINT IF EXISTS community_service_session_condition_check;

ALTER TABLE community_service_sessions
    ADD CONSTRAINT community_service_session_condition_check
    CHECK (service_condition IS NULL OR service_condition IN (
        'SATISFACTORY',
        'NEEDS_FOLLOW_UP',
        'INCIDENT_REPORTED',
        'TODAYS_SERVICE_COMPLETED',
        'LEFT_EARLY',
        'SERVICE_COMPLETED'
    ));

COMMENT ON COLUMN community_service_sessions.service_condition IS
    'Attendance outcome. Legacy values remain unchanged for historical records; new time-outs use TODAYS_SERVICE_COMPLETED, LEFT_EARLY, or SERVICE_COMPLETED.';
