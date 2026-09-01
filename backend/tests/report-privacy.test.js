const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../src/config/database');
const { getCommunityServiceReport } = require('../src/controllers/reportController');

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('administrative report projections omit raw internal identifiers and legacy violation hours', () => {
  const core = read('../src/controllers/reportController.js');
  const extended = read('../src/controllers/extendedReportController.js');
  const dtr = read('../src/controllers/communityServiceSessionReportController.js');
  assert.doesNotMatch(core, /v\.required_service_hours|v\.completed_service_hours/);
  assert.doesNotMatch(core, /cs\.id,|cs\.student_id,|v\.id as violation_id/);
  assert.doesNotMatch(extended, /SELECT pcl\.id|SELECT sc\.id/);
  assert.doesNotMatch(dtr, /SELECT a\.id AS assignment_id, a\.student_id/);
});

test('report failures do not return raw database error messages', () => {
  assert.doesNotMatch(read('../src/controllers/reportController.js'), /error:\s*error\.message/);
});

test('good-standing history excludes invalid or cancelled violations', () => {
  assert.match(read('../src/controllers/extendedReportController.js'), /FILTER \(WHERE v\.status <> 'INVALID_CANCELLED'\)/);
});

test('community-service report totals PostgreSQL numeric values numerically', async () => {
  const original = pool.query;
  pool.query = async () => ({ rows: [{ remaining_hours: '1.25' }, { remaining_hours: '2.50' }] });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await getCommunityServiceReport({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.total_pending_hours, 3.75);
  } finally {
    pool.query = original;
  }
});
