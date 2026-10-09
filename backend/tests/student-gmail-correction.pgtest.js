const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { runMigrations } = require('../scripts/migrate');
const { testDatabaseConfig } = require('./testDatabase');
const { createStudentCredentialsCorrectionController, createStudentCredentialsEmailController } = require('../src/controllers/studentController');

require('dotenv').config({ quiet: true });
const schema = `sti_vio_log_test_gmail_${process.pid}_${Date.now()}`;
const admin = new Pool(testDatabaseConfig());
const pool = new Pool(testDatabaseConfig(schema));
const oldPassword = 'Old!Temporary123';
const response = () => ({ statusCode: 200, set() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
let studentId, userId, staffId;
test.before(async () => {
  assert.match(schema, /^sti_vio_log_test_[a-z0-9_]+$/);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await runMigrations(pool, { logger: { log() {} } });
  [userId, staffId] = (await pool.query(`INSERT INTO users(username,password_hash,role,must_change_password,email_verified,temporary_password_expires_at) VALUES
    ('02000123456',$1,'STUDENT',TRUE,TRUE,CURRENT_TIMESTAMP-INTERVAL '1 hour'),('correction_staff','hash','DISCIPLINE_ADMIN',FALSE,TRUE,NULL) RETURNING id`, [await bcrypt.hash(oldPassword, 4)])).rows.map(row => row.id);
  studentId = (await pool.query(`INSERT INTO students(user_id,student_number,first_name,last_name,email,qr_code,onboarding_required,pending_google_email,pending_google_email_verified_at)
    VALUES($1,'02000123456','Test','Student','wrong@gmail.com','gmail-test-qr',TRUE,'wrong@gmail.com',CURRENT_TIMESTAMP) RETURNING id`, [userId])).rows[0].id;
  await pool.query(`INSERT INTO browser_sessions(user_id,token_hash,csrf_hash,idle_expires_at,absolute_expires_at) VALUES($1,repeat('x',64),repeat('y',64),CURRENT_TIMESTAMP+INTERVAL '1 hour',CURRENT_TIMESTAMP+INTERVAL '8 hours')`, [userId]);
  await pool.query(`INSERT INTO auth_otps(user_id,purpose,otp_hash,expires_at,target_email) VALUES($1,'STUDENT_PASSWORD_RESET',repeat('x',64),CURRENT_TIMESTAMP+INTERVAL '10 minutes','wrong@gmail.com')`, [userId]);
  await pool.query(`INSERT INTO password_reset_authorizations(user_id,token_hash,expires_at) VALUES($1,repeat('z',64),CURRENT_TIMESTAMP+INTERVAL '10 minutes')`, [userId]);
});
test.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });

test('concurrent corrections replace one password atomically, revoke authorizations, and resend only to the winner', async () => {
  const before = (await pool.query('SELECT * FROM students WHERE id=$1', [studentId])).rows[0];
  const beforeVersion = (await pool.query('SELECT session_version FROM users WHERE id=$1', [userId])).rows[0].session_version;
  const correct = createStudentCredentialsCorrectionController({ db: pool });
  const results = await Promise.all(['correct-one@gmail.com', 'correct-two@gmail.com'].map(async email => {
    const res = response();
    await correct({ user: { id: staffId, role: 'DISCIPLINE_ADMIN' }, params: { id: studentId }, body: { email, reason: 'Corrected recipient before activation', temporary_password: oldPassword } }, res);
    return res;
  }));
  assert.deepEqual(results.map(res => res.statusCode).sort(), [200, 409]);
  const winner = results.find(res => res.statusCode === 200).body;
  assert.equal(results.find(res => res.statusCode === 409).body.error.code, 'CREDENTIALS_REPLACED');
  const user = (await pool.query('SELECT * FROM users WHERE id=$1', [userId])).rows[0];
  assert(await bcrypt.compare(winner.temporary_password, user.password_hash));
  assert.equal(await bcrypt.compare(oldPassword, user.password_hash), false);
  assert.equal(user.session_version, beforeVersion + 1);
  const hours = (user.temporary_password_expires_at.getTime() - Date.now()) / 3600000;
  assert(hours > 23 && hours <= 24);
  const student = (await pool.query('SELECT * FROM students WHERE id=$1', [studentId])).rows[0];
  for (const field of ['student_number', 'first_name', 'last_name', 'onboarding_required', 'onboarding_completed_at']) assert.deepEqual(student[field], before[field]);
  assert.equal(student.pending_google_email, null);
  assert.equal(student.pending_google_email_verified_at, null);
  assert((await pool.query('SELECT revoked_at FROM browser_sessions WHERE user_id=$1', [userId])).rows[0].revoked_at);
  for (const table of ['auth_otps', 'password_reset_authorizations']) assert((await pool.query(`SELECT used_at FROM ${table} WHERE user_id=$1`, [userId])).rows[0].used_at);
  const messages = [];
  const send = createStudentCredentialsEmailController({ db: pool, emailService: { sendStudentCredentials: async message => { messages.push(message); } } });
  const stale = response();
  await send({ user: { id: staffId }, params: { id: studentId }, body: { temporary_password: oldPassword } }, stale);
  assert.equal(stale.body.error.code, 'CREDENTIALS_REPLACED');
  const sent = response();
  await send({ user: { id: staffId }, params: { id: studentId }, body: { temporary_password: winner.temporary_password } }, sent);
  assert.equal(sent.statusCode, 200);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, student.email);
  assert.equal(messages[0].temporaryPassword, winner.temporary_password);
});
