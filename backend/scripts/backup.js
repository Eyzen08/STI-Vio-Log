const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
require('dotenv').config({ quiet: true });

const defaultBackupDirectory = path.resolve(__dirname, '../../backups');
const timestamp = (date = new Date()) => date.toISOString().replace(/[:.]/g, '-');

const connectionEnvironment = (environment = process.env) => {
  const child = { ...environment };
  if (environment.DATABASE_URL) {
    const url = new URL(environment.DATABASE_URL);
    child.PGHOST = url.hostname;
    child.PGPORT = url.port || '5432';
    child.PGDATABASE = decodeURIComponent(url.pathname.replace(/^\//, ''));
    child.PGUSER = decodeURIComponent(url.username);
    child.PGPASSWORD = decodeURIComponent(url.password);
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode) child.PGSSLMODE = sslmode;
  } else {
    child.PGHOST = environment.DB_HOST;
    child.PGPORT = environment.DB_PORT || '5432';
    child.PGDATABASE = environment.DB_NAME;
    child.PGUSER = environment.DB_USER;
    child.PGPASSWORD = environment.DB_PASSWORD;
    child.PGSSLMODE = environment.DB_SSL === 'disable' ? 'disable' : environment.DB_SSL === 'no-verify' ? 'require' : 'verify-full';
  }
  for (const key of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) if (!child[key]) throw new Error(`Missing database configuration for ${key}`);
  return child;
};

const safeBackupPath = ({ directory = process.env.BACKUP_DIR || defaultBackupDirectory, fileName = process.env.BACKUP_FILE || `sti-vio-log-${timestamp()}.dump` } = {}) => {
  if (!/^[a-zA-Z0-9._-]+\.dump$/.test(fileName)) throw new Error('BACKUP_FILE must be a simple .dump filename');
  return path.join(path.resolve(directory), fileName);
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
};

const createBackup = ({ environment = process.env, execute = run, outputPath = safeBackupPath() } = {}) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  execute('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${outputPath}`], { env: connectionEnvironment(environment) });
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error('Backup archive was not created or is empty');
  return outputPath;
};

const verifyBackup = ({ archivePath, execute = run } = {}) => {
  const resolved = path.resolve(archivePath || '');
  if (!archivePath || path.extname(resolved).toLowerCase() !== '.dump' || !fs.existsSync(resolved)) throw new Error('Provide an existing .dump archive to verify');
  execute('pg_restore', ['--list', resolved]);
  return resolved;
};

if (require.main === module) {
  try {
    if (process.argv[2] === 'verify') console.log(`Backup archive verified: ${verifyBackup({ archivePath: process.argv[3] })}`);
    else console.log(`Backup created: ${createBackup()}`);
  } catch (error) { console.error(`Backup operation failed: ${error.message}`); process.exitCode = 1; }
}

module.exports = { connectionEnvironment, createBackup, defaultBackupDirectory, safeBackupPath, timestamp, verifyBackup };
