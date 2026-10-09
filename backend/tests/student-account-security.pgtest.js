const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { listMigrationFiles } = require('../scripts/migrate');
const { testDatabaseConfig } = require('./testDatabase');
const { createOtpService } = require('../src/services/otpService');
const { createStudentOnboardingService, onboardingState } = require('../src/services/studentOnboardingService');
const { createGoogleIdentityService } = require('../src/services/googleIdentityService');
const { createGoogleLinkAdministrationService } = require('../src/services/googleLinkAdministrationService');
const { createStudentPasswordAuthService } = require('../src/services/studentPasswordAuthService');
const { createPasswordChangeService } = require('../src/services/passwordChangeService');
const { createSession } = require('../src/services/browserSessionService');

require('dotenv').config({ quiet: true });
const schema = `sti_vio_log_test_activation_${process.pid}_${Date.now()}`;
const admin = new Pool(testDatabaseConfig());
const pool = new Pool(testDatabaseConfig(schema));
const migrations = path.resolve(__dirname, '../../database/migrations');
const hash = code => crypto.createHash('sha256').update(code).digest('hex');
const otpService = createOtpService({ pool, hash, generateOtp: () => '123456', sendOtp: async () => {} });
const onboarding = createStudentOnboardingService({ pool, otpService });
let pending, legacy, actor;

test.before(async () => {
  assert.match(schema, /^sti_vio_log_test_[a-z0-9_]+$/);
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (const file of listMigrationFiles(migrations).filter(file => file < '048')) await pool.query(fs.readFileSync(path.join(migrations, file), 'utf8'));
  [pending, legacy, actor] = (await pool.query(`INSERT INTO users(username,password_hash,role,must_change_password,email_verified)
    VALUES('02000111111','hash','STUDENT',TRUE,TRUE),('02000222222','hash','STUDENT',FALSE,TRUE),('recovery_staff','hash','DISCIPLINE_ADMIN',FALSE,TRUE) RETURNING id`)).rows.map(row => row.id);
  await pool.query(`INSERT INTO students(user_id,student_number,first_name,last_name,email,qr_code,onboarding_required,onboarding_completed_at,program,section,year_level,pending_google_email,pending_google_email_verified_at)
    VALUES($1,'02000111111','New','Student','new@gmail.com','new-qr',TRUE,NULL,NULL,NULL,NULL,'wrong@gmail.com',CURRENT_TIMESTAMP),
          ($2,'02000222222','Legacy','Student','legacy@gmail.com','legacy-qr',FALSE,CURRENT_TIMESTAMP,'BSIT','IT401',4,NULL,NULL)`, [pending, legacy]);
  await pool.query(`INSERT INTO auth_otps(user_id,purpose,otp_hash,expires_at,target_email) VALUES($1,'STUDENT_ONBOARDING_GOOGLE_EMAIL',$2,CURRENT_TIMESTAMP+INTERVAL '10 minutes','wrong@gmail.com')`, [pending, hash('123456')]);
});
test.after(async () => {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

test('upgrade expires existing temporary credentials and preserves legacy access', async () => {
  await pool.query(fs.readFileSync(path.join(migrations, '048_student_account_activation_security.sql'), 'utf8'));
  const rows = (await pool.query('SELECT u.*,s.onboarding_required,s.onboarding_completed_at,s.google_rebind_required,s.pending_google_email FROM users u JOIN students s ON s.user_id=u.id ORDER BY u.id')).rows;
  const hours = (rows[0].temporary_password_expires_at.getTime() - Date.now()) / 3600000;
  assert(hours > 23 && hours <= 24);
  assert.equal(rows[0].pending_google_email, null);
  assert.equal(rows[1].temporary_password_expires_at, null);
  assert.equal(onboardingState(rows[1]).onboarding_step, 'COMPLETE');
  assert((await pool.query('SELECT used_at FROM auth_otps WHERE user_id=$1', [pending])).rows[0].used_at);
  const changed = await createPasswordChangeService({ pool, comparePassword: async value => value === 'Temporary!123', hashPassword: async value => hash(value), issueToken: () => null }).change({ userId: pending, currentPassword: 'Temporary!123', newPassword: 'Unique!Password123' });
  assert.equal(changed.user.onboarding_step, 'GOOGLE');
  assert.equal((await pool.query('SELECT temporary_password_expires_at FROM users WHERE id=$1', [pending])).rows[0].temporary_password_expires_at, null);
});

test('five failed OTP attempts persist in PostgreSQL and prevent reuse', async () => {
  await assert.rejects(onboarding.requestGoogleEmail({ userId: pending, email: 'wrong@gmail.com' }), error => error.code === 'GOOGLE_EMAIL_MISMATCH');
  await onboarding.requestGoogleEmail({ userId: pending, email: 'new@gmail.com' });
  for (let i = 0; i < 5; i++) await assert.rejects(onboarding.verifyGoogleEmail({ userId: pending, code: '654321' }), error => error.code === 'OTP_INVALID_OR_EXPIRED');
  assert.equal((await pool.query('SELECT attempt_count FROM auth_otps WHERE user_id=$1 AND used_at IS NULL', [pending])).rows[0].attempt_count, 5);
  await assert.rejects(onboarding.verifyGoogleEmail({ userId: pending, code: '123456' }), error => error.code === 'OTP_ATTEMPTS_EXCEEDED');
  await pool.query(`UPDATE auth_otps SET used_at=CURRENT_TIMESTAMP WHERE user_id=$1;`, [pending]);
  await otpService.issue({ userId: pending, purpose: 'STUDENT_ONBOARDING_GOOGLE_EMAIL', email: 'new@gmail.com' });
  await onboarding.verifyGoogleEmail({ userId: pending, code: '123456' });
  await assert.rejects(onboarding.verifyGoogleEmail({ userId: pending, code: '123456' }), error => error.code === 'OTP_INVALID_OR_EXPIRED');
});

test('concurrent binding admits one Google owner and safely audits the rejected conflict', async () => {
  const second = (await pool.query(`INSERT INTO users(username,password_hash,role) VALUES('02000333333','hash','STUDENT') RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO students(user_id,student_number,first_name,last_name,email,qr_code,onboarding_required,pending_google_email,pending_google_email_verified_at)
    VALUES($1,'02000333333','Conflict','Student','new@gmail.com','conflict-qr',TRUE,'new@gmail.com',CURRENT_TIMESTAMP)`, [second]);
  const service = createGoogleIdentityService({ pool, issueToken: () => null, verifyIdentity: async () => ({ subject: 'shared-google-subject', email: 'new@gmail.com', emailVerified: true }) });
  const results = await Promise.allSettled([pending, second].map(userId => service.linkAuthenticatedStudent({ userId, credential: 'private-token' })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'STUDENT_LINK_UNAVAILABLE');
  assert.equal((await pool.query(`SELECT COUNT(*)::int AS count FROM google_identity_links WHERE google_subject='shared-google-subject' AND revoked_at IS NULL`)).rows[0].count, 1);
  const event = (await pool.query(`SELECT safe_details FROM administrative_security_events WHERE action='STUDENT_GOOGLE_LINK_CONFLICT' ORDER BY occurred_at DESC LIMIT 1`)).rows[0];
  assert.equal(event.safe_details.conflict_type, 'GOOGLE_IDENTITY');
  assert(!JSON.stringify(event).includes('shared-google-subject'));
  assert(!JSON.stringify(event).includes('private-token'));
  const linked = results.find(result => result.status === 'fulfilled').value.user;
  assert.equal(linked.onboarding_step, 'PROFILE');
  const completed = await onboarding.completeProfile({ userId: linked.id, academicLevel: 'COLLEGE', program: 'BSIT', section: 'IT101', yearLevel: 1, phoneNumber: '09171234567', guardianName: 'Maria Santos', guardianRelationship: 'Mother', guardianPhoneNumber: '09179876543' });
  assert.equal(completed.onboarding_step, 'COMPLETE');
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM student_guardians g JOIN students s ON s.id=g.student_id WHERE s.user_id=$1', [linked.id])).rows[0].count, 1);
});

test('legacy recovery revokes credentials and rejects an old-inbox OTP issued after revocation', async () => {
  await pool.query(`INSERT INTO google_identity_links(user_id,google_subject,google_email) VALUES($1,'legacy-google-subject','legacy@gmail.com');`, [legacy]);
  await pool.query(`INSERT INTO browser_sessions(user_id,token_hash,csrf_hash,idle_expires_at,absolute_expires_at) VALUES($1,repeat('x',64),repeat('y',64),CURRENT_TIMESTAMP+INTERVAL '1 hour',CURRENT_TIMESTAMP+INTERVAL '8 hours')`, [legacy]);
  await pool.query(`INSERT INTO password_reset_authorizations(user_id,token_hash,expires_at) VALUES($1,repeat('z',64),CURRENT_TIMESTAMP+INTERVAL '10 minutes')`, [legacy]);
  const before = (await pool.query('SELECT * FROM students WHERE user_id=$1', [legacy])).rows[0];
  await createGoogleLinkAdministrationService({ pool }).revokeStudentLink({ actorId: actor, studentId: before.id, email: 'replacement@gmail.com', reason: 'Identity verified against school records' });
  const after = (await pool.query('SELECT * FROM students WHERE user_id=$1', [legacy])).rows[0];
  for (const field of ['program', 'section', 'year_level', 'onboarding_completed_at']) assert.deepEqual(after[field], before[field]);
  assert.equal(after.google_rebind_required, true);
  assert.equal(onboardingState({ ...after, role: 'STUDENT' }).onboarding_step, 'GOOGLE');
  assert((await pool.query('SELECT revoked_at FROM browser_sessions WHERE user_id=$1', [legacy])).rows[0].revoked_at);
  assert((await pool.query('SELECT used_at FROM password_reset_authorizations WHERE user_id=$1', [legacy])).rows[0].used_at);
  await otpService.issue({ purpose: 'STUDENT_PASSWORD_RESET', userId: legacy, email: 'legacy@gmail.com' });
  const passwordAuth = createStudentPasswordAuthService({ pool, otpService });
  await assert.rejects(passwordAuth.verifyPasswordReset({ identifier: '02000222222', code: '123456' }), error => error.code === 'OTP_INVALID_OR_EXPIRED');
  await onboarding.requestGoogleEmail({ userId: legacy, email: 'replacement@gmail.com' });
  await onboarding.verifyGoogleEmail({ userId: legacy, code: '123456' });
  const service = createGoogleIdentityService({ pool, issueToken: () => null, verifyIdentity: async () => ({ subject: 'replacement-subject', email: 'replacement@gmail.com', emailVerified: true }) });
  assert.equal((await service.linkAuthenticatedStudent({ userId: legacy, credential: 'private-token' })).user.onboarding_step, 'COMPLETE');
});

test('session creation rejects credentials checked before recovery and expired temporary credentials', async () => {
  const captured = (await pool.query('SELECT session_version FROM users WHERE id=$1', [legacy])).rows[0].session_version;
  await pool.query('UPDATE users SET session_version=session_version+1 WHERE id=$1', [legacy]);
  await assert.rejects(createSession({ userId: legacy, expectedSessionVersion: captured, database: pool }), error => error.code === 'INVALID_CREDENTIALS');
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM browser_sessions WHERE user_id=$1 AND revoked_at IS NULL', [legacy])).rows[0].count, 0);
  await pool.query('UPDATE users SET must_change_password=TRUE,temporary_password_expires_at=CURRENT_TIMESTAMP-INTERVAL \'1 second\' WHERE id=$1', [legacy]);
  await assert.rejects(createSession({ userId: legacy, expectedSessionVersion: Number(captured) + 1, database: pool }), error => error.code === 'INVALID_CREDENTIALS');
  await pool.query('UPDATE users SET must_change_password=FALSE,temporary_password_expires_at=NULL WHERE id=$1', [legacy]);
  assert((await createSession({ userId: legacy, expectedSessionVersion: Number(captured) + 1, database: pool })).token);
});
