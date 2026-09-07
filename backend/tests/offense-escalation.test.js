const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateOffenseStatus, POLICY_SCOPE } = require('../src/services/offenseEscalationService');

test('offense indicator progresses from neutral through minor escalation', () => {
    assert.equal(calculateOffenseStatus().indicator_level, 'NEUTRAL');
    assert.equal(calculateOffenseStatus({ minor: 1 }).indicator_level, 'MINOR_1');
    assert.equal(calculateOffenseStatus({ minor: 2 }).indicator_level, 'MINOR_2');
    const escalated = calculateOffenseStatus({ minor: 3 });
    assert.equal(escalated.indicator_level, 'MAJOR_LEVEL');
    assert.equal(escalated.major_level_review_required, true);
    assert.equal(escalated.policy_scope, POLICY_SCOPE);
});

test('major and grave offenses use red and critical derived states', () => {
    assert.equal(calculateOffenseStatus({ major: 1 }).indicator_level, 'MAJOR_LEVEL');
    assert.equal(calculateOffenseStatus({ grave: 1 }).indicator_level, 'GRAVE');
    assert.equal(calculateOffenseStatus({ minor: 99, major: 1 }).major_level_review_required, false);
});
