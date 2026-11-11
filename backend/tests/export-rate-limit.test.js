const test = require('node:test');
const assert = require('node:assert/strict');
const { exportLimiter } = require('../src/middleware/rateLimiters');
const reportRoutes = require('../src/routes/reportRoutes');
const auditRoutes = require('../src/routes/auditRoutes');

const usesExportLimiter = (route) => route.stack.some((layer) => layer.handle === exportLimiter);

test('report spreadsheet exports sit behind the dedicated 30-per-window export limiter', () => {
  const exportPaths = [
    '/analytics.xlsx', '/analytics.csv', '/violations.csv', '/violations.xlsx',
    '/community-service.xlsx', '/dtr.xlsx', '/non-compliance.xlsx',
    '/parent-contacts.xlsx', '/clearance.xlsx', '/good-standing.xlsx'
  ];
  const routes = reportRoutes.stack.filter((layer) => layer.route);
  for (const path of exportPaths) {
    const route = routes.find((layer) => layer.route.path === path)?.route;
    assert.ok(route, path);
    assert.equal(usesExportLimiter(route), true, path);
  }
  const jsonPreview = routes.find((layer) => layer.route.path === '/violations' && layer.route.methods.get)?.route;
  assert.ok(jsonPreview);
  assert.equal(usesExportLimiter(jsonPreview), false);
});

test('audit Excel export sits behind the dedicated 30-per-window export limiter', () => {
  const exportRoute = auditRoutes.stack.find((layer) => layer.route?.path === '/export.xlsx')?.route;
  const listRoute = auditRoutes.stack.find((layer) => layer.route?.path === '/')?.route;
  assert.ok(exportRoute);
  assert.equal(usesExportLimiter(exportRoute), true);
  assert.equal(usesExportLimiter(listRoute), false);
});
