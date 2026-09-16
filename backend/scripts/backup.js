const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const os = require('node:os');
const { pipeline } = require('node:stream/promises');
require('dotenv').config({ quiet: true });

const defaultBackupDirectory = '';
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
    child.PGSSLMODE = sslmode || (environment.NODE_ENV === 'production' ? 'verify-full' : 'prefer');
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

const safeBackupPath = ({ directory = process.env.BACKUP_DIR || defaultBackupDirectory, fileName = process.env.BACKUP_FILE || `sti-vio-log-${timestamp()}.dump.enc` } = {}) => {
  if (!directory || !path.isAbsolute(directory)) throw new Error('BACKUP_DIR must be an explicit absolute path outside the repository');
  const resolvedDirectory=path.resolve(directory),repository=path.resolve(__dirname,'../..');
  if(resolvedDirectory===repository||resolvedDirectory.startsWith(repository+path.sep)||/OneDrive/i.test(resolvedDirectory))throw new Error('BACKUP_DIR must be outside the repository and OneDrive');
  if (!/^[a-zA-Z0-9._-]+\.dump\.enc$/.test(fileName)) throw new Error('BACKUP_FILE must be a simple .dump.enc filename');
  return path.join(resolvedDirectory, fileName);
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
};

const encryptionKey=(environment=process.env)=>{const key=Buffer.from(environment.BACKUP_ENCRYPTION_KEY||'','base64');if(key.length!==32)throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key');return key;};
const encryptFile=async(source,output,environment=process.env)=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(environment),iv);fs.writeFileSync(output,Buffer.concat([Buffer.from('STIVLG01'),iv]),{mode:0o600});await pipeline(fs.createReadStream(source),cipher,fs.createWriteStream(output,{flags:'a',mode:0o600}));fs.appendFileSync(output,cipher.getAuthTag());return output;};
const decryptFile=async(source,output,environment=process.env)=>{const fd=fs.openSync(source,'r');try{const header=Buffer.alloc(20);fs.readSync(fd,header,0,20,0);if(header.subarray(0,8).toString()!=='STIVLG01')throw new Error('Backup encryption header is invalid');const stat=fs.fstatSync(fd),tag=Buffer.alloc(16);fs.readSync(fd,tag,0,16,stat.size-16);const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(environment),header.subarray(8));decipher.setAuthTag(tag);await pipeline(fs.createReadStream(source,{start:20,end:stat.size-17}),decipher,fs.createWriteStream(output,{mode:0o600}));return output;}finally{fs.closeSync(fd)}};
const createBackup = async ({ environment = process.env, execute = run, outputPath = safeBackupPath() } = {}) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true, mode:0o700 });
  const temporary=path.join(os.tmpdir(),`sti-vio-log-${crypto.randomUUID()}.dump`);
  try{execute('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--file=${temporary}`], { env: connectionEnvironment(environment) });if(!fs.existsSync(temporary)||fs.statSync(temporary).size===0)throw new Error('Backup archive was not created or is empty');await encryptFile(temporary,outputPath,environment);return outputPath;}finally{if(fs.existsSync(temporary))fs.rmSync(temporary,{force:true})}
};

const verifyBackup = async ({ archivePath, execute = run, environment=process.env } = {}) => {
  const resolved = path.resolve(archivePath || '');
  if (!archivePath || !resolved.endsWith('.dump.enc') || !fs.existsSync(resolved)) throw new Error('Provide an existing encrypted .dump.enc archive to verify');
  const temporary=path.join(os.tmpdir(),`sti-vio-log-verify-${crypto.randomUUID()}.dump`);try{await decryptFile(resolved,temporary,environment);execute('pg_restore',['--list',temporary]);return resolved;}finally{if(fs.existsSync(temporary))fs.rmSync(temporary,{force:true})}
};

if (require.main === module) (async()=>{try{if(process.argv[2]==='verify')console.log(`Backup archive verified: ${await verifyBackup({archivePath:process.argv[3]})}`);else console.log(`Backup created: ${await createBackup()}`)}catch(error){console.error(`Backup operation failed: ${error.message}`);process.exitCode=1}})();

module.exports = { connectionEnvironment, createBackup, decryptFile, encryptFile, encryptionKey, defaultBackupDirectory, safeBackupPath, timestamp, verifyBackup };
