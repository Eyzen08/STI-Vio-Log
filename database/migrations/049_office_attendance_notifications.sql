-- Use the recipient-independent attendance key to recover each office event once.
WITH events AS (
    SELECT DISTINCT ON (regexp_replace(n.event_key, ':[0-9]+$', ''))
           n.*, regexp_replace(n.event_key, ':[0-9]+$', '') AS office_event_key
    FROM notifications n JOIN users source ON source.id = n.user_id
    WHERE source.role IN ('DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE')
      AND n.category = 'ATTENDANCE'
      AND n.event_key ~ '^attendance:([0-9]+|attempt):[a-z_]+:[^:]+:[0-9]+$'
      AND split_part(n.event_key, ':', 5) = n.user_id::text
    ORDER BY regexp_replace(n.event_key, ':[0-9]+$', ''), n.created_at, n.id
)
INSERT INTO notifications (
    user_id, title, message, notification_type, event_key, category, severity,
    resource_type, resource_id, link_path, metadata, created_at
)
SELECT recipient.id, e.title, e.message, e.notification_type,
       e.office_event_key || ':' || recipient.id, e.category, e.severity,
       e.resource_type, e.resource_id, e.link_path, e.metadata, e.created_at
FROM events e CROSS JOIN users recipient
WHERE recipient.is_active = TRUE
  AND recipient.role IN ('DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE')
ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING;
