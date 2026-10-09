-- Recover identifiers from structured event keys, never from notification prose.
WITH targets AS (
    SELECT n.id, 'community_service_assignments' AS resource_type, a.id AS resource_id,
           jsonb_build_object('assignment_id', a.id, 'student_id', a.student_id) AS metadata
    FROM notifications n JOIN community_service_assignments a ON a.id::text = split_part(n.event_key, ':', 2)
    WHERE n.event_key ~ '^service:[0-9]+:assigned:(student|head)$'
    UNION ALL
    SELECT n.id, 'community_service_sessions', s.id, jsonb_build_object('assignment_id', s.assignment_id)
    FROM notifications n JOIN community_service_sessions s ON s.id::text = split_part(n.event_key, ':', 2)
    WHERE n.event_key ~ '^service-session:[0-9]+:(time-in|time-out|approved|rejected)$'
    UNION ALL
    SELECT n.id, 'violations', v.id, jsonb_build_object('student_id', v.student_id)
    FROM notifications n JOIN violations v ON v.id::text = split_part(n.event_key, ':', 2)
    WHERE n.event_key ~ '^violation:[0-9]+:(created|updated:)'
    UNION ALL
    SELECT n.id, 'violations', a.violation_id, '{}'::jsonb
    FROM notifications n JOIN violation_actions a ON a.id::text = split_part(n.event_key, ':', 2)
    WHERE n.event_key ~ '^violation-action:[0-9]+$'
)
UPDATE notifications n SET resource_type = COALESCE(n.resource_type, t.resource_type),
    resource_id = COALESCE(n.resource_id, t.resource_id), metadata = n.metadata || t.metadata
FROM targets t WHERE n.id = t.id AND (n.resource_type IS NULL OR n.resource_type = t.resource_type);

UPDATE notifications n SET metadata = n.metadata || jsonb_build_object('assignment_id', s.assignment_id)
FROM community_service_sessions s WHERE n.resource_type = 'community_service_sessions' AND n.resource_id = s.id;

UPDATE notifications n SET resource_type = 'students', resource_id = s.id
FROM students s WHERE n.category = 'ATTENDANCE' AND n.resource_id IS NULL
    AND s.id::text = n.metadata->>'student_id';

UPDATE notifications SET category = CASE
    WHEN notification_type LIKE 'SERVICE_%' THEN 'COMMUNITY_SERVICE'
    WHEN notification_type LIKE 'VIOLATION_%' THEN 'VIOLATIONS'
    ELSE category END
WHERE category = 'SYSTEM';

UPDATE notifications n SET link_path =
    CASE u.role WHEN 'STUDENT' THEN '/student/' WHEN 'DEPARTMENT_HEAD' THEN '/department/' ELSE '/admin/' END ||
    CASE n.resource_type
        WHEN 'violations' THEN 'violations?violation_id=' || n.resource_id
        WHEN 'community_service_assignments' THEN 'community-service?assignment_id=' || n.resource_id
        WHEN 'community_service_sessions' THEN 'community-service?' ||
            CASE WHEN n.metadata->>'assignment_id' ~ '^[0-9]+$' THEN 'assignment_id=' || (n.metadata->>'assignment_id') || '&' ELSE '' END || 'session_id=' || n.resource_id
        WHEN 'students' THEN 'students?student_id=' || n.resource_id
        WHEN 'message_conversations' THEN 'messages?conversation_id=' || n.resource_id
        WHEN 'student_clearance' THEN 'clearance?clearance_id=' || n.resource_id
        WHEN 'clearance_certificates' THEN 'clearance?' || CASE WHEN u.role = 'STUDENT' THEN '' ELSE 'panel=history&' END || 'certificate_id=' || n.resource_id
    END
FROM users u WHERE u.id = n.user_id AND n.resource_id > 0
    AND n.resource_type IN ('violations','community_service_assignments','community_service_sessions','students','message_conversations','student_clearance','clearance_certificates');

UPDATE notifications n SET link_path =
    CASE u.role WHEN 'STUDENT' THEN '/student/' WHEN 'DEPARTMENT_HEAD' THEN '/department/' ELSE '/admin/' END || 'account-settings?section=security'
FROM users u WHERE u.id = n.user_id AND n.category = 'SECURITY' AND n.link_path IS NULL;
