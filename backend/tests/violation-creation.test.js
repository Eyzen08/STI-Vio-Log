const test = require('node:test');
const assert = require('node:assert/strict');
const { currentManilaDate, normalizeViolationInput } = require('../src/services/violationCreationService');

const now = new Date('2026-11-26T02:00:00Z'); // 10:00 in Asia/Manila
const input = (incidentDate) => ({
    studentId: 1, violationTypeId: 1, incidentDate, incidentTime: '09:15', description: 'Missed incident', now
});

test('new violations accept today or a backfilled past date in Asia/Manila', () => {
    assert.equal(currentManilaDate(now), '2026-11-26');
    for (const incidentDate of ['2026-11-26', '2026-11-25', '2026-01-15']) {
        assert.equal(normalizeViolationInput(input(incidentDate)).incidentDate, incidentDate);
    }
});

test('new violations reject future or invalid incident dates', () => {
    assert.throws(() => normalizeViolationInput(input('2026-11-27')), /cannot be in the future/);
    assert.throws(() => normalizeViolationInput(input('2026-02-30')), /valid incident date/);
    assert.throws(() => normalizeViolationInput(input('15/01/2026')), /valid incident date/);
});
