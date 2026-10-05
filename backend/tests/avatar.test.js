const test = require('node:test');
const assert = require('node:assert/strict');
const { PRESET_IDS, validateSelection, parseAvatarImage, avatarMetadata, createAvatarService } = require('../src/services/avatarService');
const { createAvatarController } = require('../src/controllers/avatarController');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=';

test('selection accepts only the catalog and an available photo', () => {
  assert.equal(PRESET_IDS.length, 48);
  for (const preset_id of PRESET_IDS) assert.doesNotThrow(() => validateSelection({ source: 'PRESET', preset_id }, false));
  for (const preset_id of ['portrait-00', 'portrait-49', '../photo', 1]) assert.throws(() => validateSelection({ source: 'PRESET', preset_id }, false), { code: 'INVALID_AVATAR' });
  assert.throws(() => validateSelection({ source: 'PHOTO' }, false), { code: 'AVATAR_PHOTO_UNAVAILABLE' });
  assert.doesNotThrow(() => validateSelection({ source: 'PHOTO' }, true));
  assert.doesNotThrow(() => validateSelection({ source: 'INITIALS' }, false));
  assert.throws(() => validateSelection({ source: 'REMOTE' }, true));
});

test('photos reject mismatched, malformed, oversized, and excessive dimension images', () => {
  assert.equal(parseAvatarImage(png).mimeType, 'image/png');
  for (const value of [null, 'data:image/svg+xml;base64,PHN2Zy8+', png.replace('png', 'jpeg'), 'data:image/png;base64,abc===', 'x'.repeat(1_400_001)]) {
    assert.throws(() => parseAvatarImage(value), { code: 'INVALID_AVATAR_IMAGE' });
  }
  const buffer = Buffer.from(png.split(',')[1], 'base64'); buffer.writeUInt32BE(5000, 16);
  assert.throws(() => parseAvatarImage(`data:image/png;base64,${buffer.toString('base64')}`), { code: 'INVALID_AVATAR_IMAGE' });
});

test('metadata contains a revisioned protected URL and never image bytes', () => {
  assert.deepEqual(avatarMetadata({ id: 2 }), { source: 'INITIALS', preset_id: null, photo_url: null });
  const avatar = avatarMetadata({ id: 2, avatar_source: 'PRESET', avatar_preset_id: 'portrait-03', avatar_photo_revision: 'revision', image_data: Buffer.from('private') });
  assert.equal(avatar.photo_url, '/api/avatars/2/photo?v=revision');
  assert.equal(avatar.source, 'PRESET'); assert.equal(JSON.stringify(avatar).includes('private'), false);
});

test('selection derives the user from the session and rolls back audit failures', async () => {
  const calls = []; let released = false;
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FOR UPDATE')) return { rows: [{ id: 7, role: 'STUDENT' }] };
    if (sql.startsWith('INSERT INTO audit_logs')) throw new Error('Audit unavailable');
    return { rows: [] };
  }, release() { released = true; } };
  const service = createAvatarService({ pool: { connect: async () => client } });
  await assert.rejects(() => service.select({ id: 7 }, { source: 'PRESET', preset_id: 'portrait-03' }), /Audit unavailable/);
  assert.equal(calls.find(({ sql }) => sql.startsWith('UPDATE users')).params[0], 7);
  assert.ok(calls.some(({ sql }) => sql === 'ROLLBACK')); assert.ok(!calls.some(({ sql }) => sql === 'COMMIT')); assert.ok(released);
});

test('controller rejects target-user overrides before calling the selection service', async () => {
  let called = false;
  const controller = createAvatarController({ service: { select: async () => { called = true; } } });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await controller.select({ user: { id: 7 }, body: { source: 'INITIALS', user_id: 9 } }, res);
  assert.equal(res.code, 400); assert.equal(called, false);
});

test('photo mutations deny students and department heads before database access', async () => {
  const service = createAvatarService({ pool: { connect() { throw new Error('Unexpected database access'); } } });
  for (const role of ['STUDENT', 'DEPARTMENT_HEAD']) await assert.rejects(() => service.changePhoto({ id: 7, role }, 2, { image_data_url: png, reason: 'School photo' }, false), { statusCode: 403 });
});

test('photo reads deny unrelated students and apply department attendance scope', async () => {
  const calls = [];
  const service = createAvatarService({ pool: { query: async (sql) => { calls.push(sql); return { rows: [] }; } } });
  await assert.rejects(() => service.readPhoto({ id: 7, role: 'STUDENT' }, 8), { statusCode: 404 });
  assert.equal(calls.length, 0);
  await assert.rejects(() => service.readPhoto({ id: 7, role: 'DEPARTMENT_HEAD', department_id: 3 }, 8), { statusCode: 404 });
  assert.match(calls[0], /css.department_id=\$2/); assert.match(calls[0], /d.is_active=TRUE/);
});

test('photo routes permit only the two student management roles', async () => {
  const router = require('../src/routes/studentRoutes');
  for (const method of ['post', 'delete']) {
    const route = router.stack.find((layer) => layer.route?.path === '/:id/avatar' && layer.route.methods[method]).route;
    for (const role of ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT']) {
      let allowed = false;
      const res = { status() { return this; }, json() { return this; } };
      await route.stack[0].handle({ user: { role } }, res, () => { allowed = true; });
      assert.equal(allowed, ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'].includes(role));
    }
  }
});
