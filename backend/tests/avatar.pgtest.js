const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
require('dotenv').config({ quiet: true });
const { testDatabaseConfig } = require('./testDatabase');
const { runMigrations } = require('../scripts/migrate');
const { createAvatarService, avatarSql } = require('../src/services/avatarService');

const schema = `sti_vio_log_test_avatar_${process.pid}_${Date.now()}`;
const admin = new Pool(testDatabaseConfig());
const pool = new Pool(testDatabaseConfig(schema));
const service = createAvatarService({ pool });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=';
let student, officer;
test.before(async () => {
  if (!/^sti_vio_log_test_avatar_\d+_\d+$/.test(schema)) throw new Error('Unsafe test schema');
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool, { logger: { log() {} } });
  const users = (await pool.query(`INSERT INTO users(username,password_hash,role,is_active,email_verified,must_change_password)
    VALUES('avatar_student','test-hash','STUDENT',TRUE,TRUE,FALSE),('avatar_officer','test-hash','DISCIPLINE_OFFICE',TRUE,TRUE,FALSE) RETURNING *`)).rows;
  student = users[0]; officer = users[1];
  const record = (await pool.query(`INSERT INTO students(user_id,student_number,first_name,last_name,qr_code,onboarding_required)
    VALUES($1,'02000123456','Avatar','Student','avatar-test-qr',FALSE) RETURNING id`, [student.id])).rows[0];
  student.student_id = record.id;
});
test.after(async () => {
  await pool.end();
  if (/^sti_vio_log_test_avatar_\d+_\d+$/.test(schema)) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

test('preset, upload, switching, replacement, and removal persist across connections', async () => {
  assert.equal((await service.get(student.id)).source, 'INITIALS');
  await service.select(student, { source: 'PRESET', preset_id: 'portrait-12' });
  const uploaded = await service.changePhoto(officer, student.student_id, { image_data_url: png, reason: 'Verified school photo' }, false);
  assert.equal(uploaded.avatar.source, 'PHOTO'); assert.equal(uploaded.avatar.preset_id, 'portrait-12');
  const revision = new URL(uploaded.avatar.photo_url, 'http://local').searchParams.get('v');
  const photo = await service.readPhoto(student, student.id, revision);
  assert.ok(photo.image_data.equals(Buffer.from(png.split(',')[1], 'base64')));
  await service.select(student, { source: 'PRESET', preset_id: 'portrait-34' });
  const switched = await service.get(student.id);
  assert.equal(switched.source, 'PRESET'); assert.equal(switched.photo_url, uploaded.avatar.photo_url);
  const replacement = await service.changePhoto(officer, student.student_id, { image_data_url: png, reason: 'Updated photo' }, false);
  assert.notEqual(replacement.avatar.photo_url, uploaded.avatar.photo_url);
  await assert.rejects(() => service.readPhoto(student, student.id, revision), { statusCode: 404 });
  const removed = await service.changePhoto(officer, student.student_id, { reason: 'Photo removal requested' }, true);
  assert.equal(removed.avatar.source, 'PRESET'); assert.equal(removed.avatar.preset_id, 'portrait-34'); assert.equal(removed.avatar.photo_url, null);
  await assert.rejects(() => service.select(student, { source: 'PHOTO' }), { code: 'AVATAR_PHOTO_UNAVAILABLE' });
  const metadata = (await pool.query(`SELECT ${avatarSql('u.id')} AS avatar FROM users u WHERE id=$1`, [student.id])).rows[0].avatar;
  assert.deepEqual(metadata, removed.avatar);
  const audits = (await pool.query("SELECT action,description FROM audit_logs WHERE action LIKE '%AVATAR%' ORDER BY id")).rows;
  assert.ok(audits.some(({ action }) => action === 'STUDENT_AVATAR_UPLOAD'));
  assert.ok(audits.some(({ action }) => action === 'STUDENT_AVATAR_REMOVE'));
  assert.equal(JSON.stringify(audits).includes('base64'), false);
});

test('invalid requests preserve the existing selection and photo', async () => {
  const before = await service.get(student.id);
  await assert.rejects(() => service.changePhoto(officer, student.student_id, { image_data_url: png, reason: '' }, false));
  await assert.rejects(() => service.changePhoto(officer, student.student_id, { image_data_url: 'data:image/png;base64,invalid', reason: 'Invalid image' }, false));
  await assert.rejects(() => service.select(student, { source: 'PRESET', preset_id: 'portrait-99' }));
  assert.deepEqual(await service.get(student.id), before);
  await service.select(officer, { source: 'PRESET', preset_id: 'portrait-08' });
  assert.equal((await service.get(officer.id)).preset_id, 'portrait-08');
  await assert.rejects(() => service.select(officer, { source: 'PHOTO' }), { code: 'AVATAR_PHOTO_UNAVAILABLE' });
});

test('audit failure rolls back a photo upload and its selection change', async () => {
  await pool.query(`CREATE FUNCTION reject_avatar_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.action='STUDENT_AVATAR_UPLOAD' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_avatar_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_avatar_audit()`);
  const before = await service.get(student.id);
  try {
    await assert.rejects(() => service.changePhoto(officer, student.student_id, { image_data_url: png, reason: 'Rollback check' }, false), /audit unavailable/);
    assert.deepEqual(await service.get(student.id), before);
    assert.equal((await pool.query('SELECT 1 FROM user_avatar_photos WHERE user_id=$1', [student.id])).rows.length, 0);
  } finally { await pool.query('DROP TRIGGER reject_avatar_audit ON audit_logs; DROP FUNCTION reject_avatar_audit()'); }
});

test('new photo table has RLS and runtime grants, with no public access', async () => {
  const table = (await pool.query('SELECT rowsecurity FROM pg_tables WHERE schemaname=$1 AND tablename=\'user_avatar_photos\'', [schema])).rows[0];
  assert.equal(table.rowsecurity, true);
  const grants = (await pool.query("SELECT privilege_type FROM information_schema.role_table_grants WHERE table_schema=$1 AND table_name='user_avatar_photos' AND grantee='sti_vio_log_runtime'", [schema])).rows;
  assert.deepEqual(grants.map(({ privilege_type }) => privilege_type).sort(), ['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
});
