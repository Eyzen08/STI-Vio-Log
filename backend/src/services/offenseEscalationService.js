const POLICY_SCOPE = 'ALL_HISTORY';

const calculateOffenseStatus = ({ minor = 0, major = 0, grave = 0 } = {}) => {
    const minorCount = Math.max(0, Number(minor) || 0);
    const majorCount = Math.max(0, Number(major) || 0);
    const graveCount = Math.max(0, Number(grave) || 0);

    let indicatorLevel = 'NEUTRAL';
    let label = 'No qualifying offenses';

    if (graveCount > 0) {
        indicatorLevel = 'GRAVE';
        label = `${graveCount} grave offense${graveCount === 1 ? '' : 's'}`;
    } else if (majorCount > 0) {
        indicatorLevel = 'MAJOR_LEVEL';
        label = `${majorCount} major offense${majorCount === 1 ? '' : 's'}`;
    } else if (minorCount >= 3) {
        indicatorLevel = 'MAJOR_LEVEL';
        label = `Major-level status from ${minorCount} minor offenses`;
    } else if (minorCount === 2) {
        indicatorLevel = 'MINOR_2';
        label = '2 minor offenses';
    } else if (minorCount === 1) {
        indicatorLevel = 'MINOR_1';
        label = '1 minor offense';
    }

    return {
        policy_scope: POLICY_SCOPE,
        minor_count: minorCount,
        major_count: majorCount,
        grave_count: graveCount,
        indicator_level: indicatorLevel,
        label,
        major_level_review_required: minorCount >= 3 && majorCount === 0 && graveCount === 0
    };
};

const recalculateOffenseStatus = async ({ client, studentId, actor = null, ipAddress = null }) => {
    // Serialize calculations for one student. This keeps simultaneous creation
    // of the third minor offense idempotent without creating a synthetic case.
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(studentId)]);

    const countsResult = await client.query(
        `SELECT
            COUNT(*) FILTER (WHERE vt.severity = 'MINOR')::int AS minor,
            COUNT(*) FILTER (WHERE vt.severity = 'MAJOR')::int AS major,
            COUNT(*) FILTER (WHERE vt.severity = 'GRAVE')::int AS grave
         FROM violations v
         JOIN violation_types vt ON vt.id = v.violation_type_id
         WHERE v.student_id = $1 AND v.status <> 'INVALID_CANCEL'`,
        [studentId]
    );
    const next = calculateOffenseStatus(countsResult.rows[0]);

    const previousResult = await client.query(
        'SELECT * FROM student_offense_escalations WHERE student_id = $1 FOR UPDATE',
        [studentId]
    );
    const previous = previousResult.rows[0] || null;

    const savedResult = await client.query(
        `INSERT INTO student_offense_escalations (
            student_id, policy_scope, minor_count, major_count, grave_count,
            indicator_level, major_level_review_required, calculated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (student_id) DO UPDATE SET
            minor_count = EXCLUDED.minor_count,
            major_count = EXCLUDED.major_count,
            grave_count = EXCLUDED.grave_count,
            indicator_level = EXCLUDED.indicator_level,
            major_level_review_required = EXCLUDED.major_level_review_required,
            calculated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [studentId, POLICY_SCOPE, next.minor_count, next.major_count, next.grave_count,
            next.indicator_level, next.major_level_review_required]
    );

    const changed = !previous || previous.indicator_level !== next.indicator_level
        || Boolean(previous.major_level_review_required) !== next.major_level_review_required;
    if (changed && actor?.id) {
        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, description, ip_address)
             VALUES ($1, $2, 'student_offense_escalations', $3, $4, $5)`,
            [actor.id, next.indicator_level === 'NEUTRAL' ? 'OFFENSE_DEESCALATED' : 'OFFENSE_ESCALATED',
                studentId, JSON.stringify({ from: previous?.indicator_level || 'NEUTRAL', to: next.indicator_level,
                    policy_scope: POLICY_SCOPE, minor_count: next.minor_count, major_count: next.major_count,
                    grave_count: next.grave_count, major_level_review_required: next.major_level_review_required }), ipAddress]
        );
    }

    return { ...savedResult.rows[0], label: next.label };
};

module.exports = { POLICY_SCOPE, calculateOffenseStatus, recalculateOffenseStatus };

