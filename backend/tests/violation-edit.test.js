const test = require('node:test');
const assert = require('node:assert/strict');
const { editViolationWithClient, validateEdit, parseHours, validDate } = require('../src/services/violationEditService');

test('both office roles reach the active-session safeguard when correcting credited hours', async () => {
    for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE']) {
        const client = { query: async sql => {
            if (sql.startsWith('SELECT * FROM community_service_assignments')) return { rows: [{ id: 8 }] };
            if (sql.startsWith('SELECT * FROM violations')) return { rows: [{ id: 9, student_id: 3, status: 'OPEN', violation_type_id: 1, required_service_hours: 3, completed_service_hours: 0, description: 'Facts' }] };
            if (sql.startsWith('SELECT * FROM violation_types')) return { rows: [{ id: 1, is_active: true }] };
            if (sql.includes('FROM community_service_sessions')) return { rows: [{ id: 10 }] };
            return { rows: [] };
        } };
        await assert.rejects(editViolationWithClient({ client, violationId: 9, body: { completed_service_hours: 1, reason: 'Credit correction' }, actor: { id: 2, role } }),
            error => error.statusCode === 409 && /Time out/.test(error.message), role);
    }
});

test('hour corrections reject blank, coercible nonnumeric, nonfinite, and out-of-precision values', () => {
    for (const value of [null, true, false, [], {}, '', ' ', 'NaN', Infinity, -1, 10000, 0.001]) assert.throws(() => parseHours(value, 'Hours'));
    assert.equal(parseHours('0', 'Hours'), 0);
    assert.equal(parseHours('9999.99', 'Hours'), 9999.99);
    assert.equal(parseHours('1.50', 'Hours'), 1.5);
});

test('edit validation preserves explicit time removal and requires a bounded reason', () => {
    const input = { incident_time: '', required_service_hours: '1.5', description: ' Corrected facts ', reason: ' Review ' };
    assert.deepEqual(validateEdit(input, { role: 'DISCIPLINE_ADMIN' }).fields, { incident_time: null, required_service_hours: 1.5, description: 'Corrected facts' });
    assert.equal(validateEdit(input, {}).reason, 'Review');
    for (const reason of ['', ' ', 'x'.repeat(1001)]) assert.throws(() => validateEdit({ ...input, reason }, {}));
    assert.throws(() => validateEdit({ ...input, student_id: 3 }, {}), /Unsupported field/);
    assert.throws(() => validateEdit({ ...input, status: 'CLEAR' }, {}), /Unsupported field/);
    assert.throws(() => validateEdit({ reason: 'No fields' }, {}), /No violation fields/);
});

test('incident dates must be real calendar dates', () => {
    assert.equal(validDate('2026-02-30'), false);
    assert.equal(validDate('2026-02-29'), false);
    assert.equal(validDate('2028-02-29'), true);
    assert.equal(validDate('2026-10-06'), true);
});
