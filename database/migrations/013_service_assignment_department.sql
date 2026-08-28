-- New community-service assignments are routed to an active department and
-- its accountable Department Head. Columns remain nullable for historical
-- assignments created before department routing existed.
ALTER TABLE community_service_assignments
    ADD COLUMN department_id BIGINT REFERENCES departments(id) ON DELETE RESTRICT,
    ADD COLUMN department_head_id BIGINT REFERENCES department_heads(id) ON DELETE RESTRICT;

CREATE INDEX idx_service_assignment_department
    ON community_service_assignments (department_id, status, assigned_at DESC);

CREATE INDEX idx_service_assignment_head
    ON community_service_assignments (department_head_id, status, assigned_at DESC);
