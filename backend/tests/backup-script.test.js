const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const path = require('node:path');
const { connectionEnvironment, decryptFile, encryptFile, safeBackupPath, timestamp } = require('../scripts/backup');

test('backup timestamp and filename are filesystem safe',()=>{assert.equal(timestamp(new Date('2026-08-28T10:20:30.123Z')),'2026-08-28T10-20-30-123Z');const directory=path.resolve(path.parse(process.cwd()).root,'sti-vio-log-secure-backups');assert.match(path.basename(safeBackupPath({directory,fileName:'sti-vio-log-test.dump.enc'})),/\.dump\.enc$/);assert.throws(()=>safeBackupPath({directory,fileName:'../secret.dump.enc'}),/simple/)});
test('connection URL becomes libpq environment without entering command arguments',()=>{const env=connectionEnvironment({DATABASE_URL:'postgresql://app:p%40ss@db.example.test:5433/vio?sslmode=require'});assert.equal(env.PGHOST,'db.example.test');assert.equal(env.PGDATABASE,'vio');assert.equal(env.PGPASSWORD,'p@ss');assert.equal(env.PGSSLMODE,'require')});
test('individual database settings map to libpq environment',()=>{const env=connectionEnvironment({DB_HOST:'localhost',DB_PORT:'5432',DB_NAME:'vio',DB_USER:'app',DB_PASSWORD:'private',DB_SSL:'disable'});assert.equal(env.PGDATABASE,'vio');assert.equal(env.PGSSLMODE,'disable')});
test('backup encryption authenticates content and rejects tampering',async()=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'sti-backup-test-'));const source=path.join(directory,'source.dump'),encrypted=path.join(directory,'archive.dump.enc'),restored=path.join(directory,'restored.dump');const environment={BACKUP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('base64')};try{fs.writeFileSync(source,crypto.randomBytes(4096));await encryptFile(source,encrypted,environment);await decryptFile(encrypted,restored,environment);assert.deepEqual(fs.readFileSync(restored),fs.readFileSync(source));const altered=fs.readFileSync(encrypted);altered[30]^=1;fs.writeFileSync(encrypted,altered);await assert.rejects(decryptFile(encrypted,restored,environment));}finally{fs.rmSync(directory,{recursive:true,force:true})}});
