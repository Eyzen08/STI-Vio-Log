-- Explicitly scope conversations intended for a Department Head to one department.
-- Existing conversations remain Discipline Office conversations and are not exposed
-- to Department Heads merely because the student once served in their department.
ALTER TABLE message_conversations
    ADD COLUMN assigned_department_id BIGINT REFERENCES departments(id) ON DELETE RESTRICT;

CREATE INDEX idx_message_conversations_department_time
    ON message_conversations (assigned_department_id, updated_at DESC)
    WHERE assigned_department_id IS NOT NULL;
