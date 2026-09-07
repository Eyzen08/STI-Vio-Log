-- Incident time is stored separately from the historical incident date so old
-- records remain valid and can explicitly report that no time was recorded.
ALTER TABLE violations
    ADD COLUMN incident_time TIME;

-- This is derived disciplinary state. It never replaces or mutates the source
-- violation records. Until an academic-term relation is available, the policy
-- deliberately uses the student's complete retained violation history.
CREATE TABLE student_offense_escalations (
    student_id BIGINT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    policy_scope VARCHAR(30) NOT NULL DEFAULT 'ALL_HISTORY',
    minor_count INTEGER NOT NULL DEFAULT 0,
    major_count INTEGER NOT NULL DEFAULT 0,
    grave_count INTEGER NOT NULL DEFAULT 0,
    indicator_level VARCHAR(30) NOT NULL DEFAULT 'NEUTRAL',
    major_level_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT offense_escalation_counts_nonnegative CHECK (
        minor_count >= 0 AND major_count >= 0 AND grave_count >= 0
    ),
    CONSTRAINT offense_escalation_level CHECK (
        indicator_level IN ('NEUTRAL', 'MINOR_1', 'MINOR_2', 'MAJOR_LEVEL', 'GRAVE')
    ),
    CONSTRAINT offense_escalation_scope CHECK (policy_scope = 'ALL_HISTORY')
);

INSERT INTO student_offense_escalations (
    student_id, minor_count, major_count, grave_count,
    indicator_level, major_level_review_required
)
SELECT
    s.id,
    COUNT(v.id) FILTER (WHERE vt.severity = 'MINOR')::int,
    COUNT(v.id) FILTER (WHERE vt.severity = 'MAJOR')::int,
    COUNT(v.id) FILTER (WHERE vt.severity = 'GRAVE')::int,
    CASE
        WHEN COUNT(v.id) FILTER (WHERE vt.severity = 'GRAVE') > 0 THEN 'GRAVE'
        WHEN COUNT(v.id) FILTER (WHERE vt.severity = 'MAJOR') > 0
          OR COUNT(v.id) FILTER (WHERE vt.severity = 'MINOR') >= 3 THEN 'MAJOR_LEVEL'
        WHEN COUNT(v.id) FILTER (WHERE vt.severity = 'MINOR') = 2 THEN 'MINOR_2'
        WHEN COUNT(v.id) FILTER (WHERE vt.severity = 'MINOR') = 1 THEN 'MINOR_1'
        ELSE 'NEUTRAL'
    END,
    COUNT(v.id) FILTER (WHERE vt.severity = 'MINOR') >= 3
      AND COUNT(v.id) FILTER (WHERE vt.severity = 'MAJOR') = 0
      AND COUNT(v.id) FILTER (WHERE vt.severity = 'GRAVE') = 0
FROM students s
LEFT JOIN violations v
    ON v.student_id = s.id AND v.status <> 'INVALID_CANCEL'
LEFT JOIN violation_types vt ON vt.id = v.violation_type_id
GROUP BY s.id;

CREATE INDEX idx_offense_escalations_level
    ON student_offense_escalations(indicator_level, calculated_at DESC);

