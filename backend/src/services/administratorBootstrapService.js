const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { passwordIsStrong } = require('./passwordPolicy');

const BOOTSTRAP_ROLES = new Set(['SYSTEM_ADMIN', 'DISCIPLINE_ADMIN']);
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const createAdministratorBootstrapService = ({
  pool,
  hashPassword = (value) => bcrypt.hash(value, 12),
  randomBytes = crypto.randomBytes
} = {}) => ({
  async bootstrap({ role, username, password, firstName, lastName, email }) {
    const values = {
      role: clean(role, 40).toUpperCase(),
      username: clean(username, 100).toLowerCase(),
      firstName: clean(firstName, 100),
      lastName: clean(lastName, 100),
      email: clean(email, 255).toLowerCase() || null
    };
    if (!BOOTSTRAP_ROLES.has(values.role) || !/^[a-z0-9._-]{3,100}$/.test(values.username) || !values.firstName || !values.lastName) {
      throw new Error('A supported role and valid individual administrator identity are required');
    }
    const generated = !password;
    const credential = password || `${randomBytes(24).toString('base64url')}!Aa1`;
    if (!passwordIsStrong(credential)) throw new Error('Password does not meet the administrator password policy');
    const passwordHash = await hashPassword(credential);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('administrator-bootstrap'))");
      const existing = await client.query('SELECT id FROM users WHERE role=$1 LIMIT 1', [values.role]);
      if (existing.rowCount) throw new Error(`An initial ${values.role} already exists; use the audited recovery process`);
      const account = (await client.query(
        `INSERT INTO users(username,password_hash,role,is_active,must_change_password,session_version)
         VALUES($1,$2,$3,TRUE,TRUE,1) RETURNING id,username,role`,
        [values.username, passwordHash, values.role]
      )).rows[0];
      await client.query(
        `INSERT INTO admin_profiles(user_id,first_name,last_name,email,email_verified)
         VALUES($1,$2,$3,$4,FALSE)`,
        [account.id, values.firstName, values.lastName, values.email]
      );
      await client.query(
        `INSERT INTO audit_logs(user_id,action,table_name,record_id,description)
         VALUES($1,'ADMIN_BOOTSTRAP','users',$1,$2)`,
        [account.id, `Created initial individual ${values.role} account; forced password change required`]
      );
      await client.query('COMMIT');
      return { account: { id: Number(account.id), username: account.username, role: account.role }, generatedPassword: generated ? credential : null };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw error;
    } finally {
      client.release();
    }
  }
});

module.exports = { BOOTSTRAP_ROLES, createAdministratorBootstrapService };
