const normalizeOrigin = (value, name) => {
  let url;
  try { url = new URL(String(value || '')); } catch (_) { throw new Error(`${name} must be a valid HTTPS origin`); }
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an HTTPS origin without a path`);
  }
  return url.origin;
};

const requireStatus = async (response, expected, label) => {
  if (response.status !== expected) throw new Error(`${label} returned HTTP ${response.status}; expected ${expected}`);
  return response;
};

const runProductionSmoke = async ({ apiOrigin, frontendOrigin, fetchImpl = fetch } = {}) => {
  const api = normalizeOrigin(apiOrigin, 'PRODUCTION_API_URL');
  const frontend = normalizeOrigin(frontendOrigin, 'PRODUCTION_FRONTEND_URL');

  const health = await requireStatus(await fetchImpl(`${api}/api/health`), 200, 'API health');
  const healthBody = await health.json();
  if (healthBody?.success !== true || healthBody?.database !== 'connected') throw new Error('API health did not confirm database connectivity');

  await requireStatus(await fetchImpl(`${frontend}/student/login`, { redirect: 'manual' }), 200, 'Frontend direct route');
  await requireStatus(await fetchImpl(`${api}/api/students/me`), 401, 'Protected endpoint');

  const preflight = await requireStatus(await fetchImpl(`${api}/api/auth/google/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: frontend,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type'
    }
  }), 204, 'Approved-origin preflight');
  if (preflight.headers.get('access-control-allow-origin') !== frontend) throw new Error('Approved frontend origin was not returned by CORS');

  const denied = await requireStatus(await fetchImpl(`${api}/api/auth/google/login`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://unapproved.invalid', 'Access-Control-Request-Method': 'POST' }
  }), 403, 'Unapproved-origin preflight');
  if (denied.headers.get('access-control-allow-origin')) throw new Error('Unapproved origin received a CORS allow-origin header');

  return { api_health: 'passed', frontend_route: 'passed', authentication_boundary: 'passed', cors: 'passed' };
};

if (require.main === module) {
  runProductionSmoke({ apiOrigin: process.env.PRODUCTION_API_URL, frontendOrigin: process.env.PRODUCTION_FRONTEND_URL })
    .then((result) => console.log(`Production smoke passed: ${Object.keys(result).join(', ')}.`))
    .catch((error) => { console.error(`Production smoke failed: ${error.message}`); process.exitCode = 1; });
}

module.exports = { normalizeOrigin, runProductionSmoke };
