const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { connectionEnvironment, safeBackupPath, timestamp } = require('../scripts/backup');

test('backup timestamp and filename are filesystem safe',()=>{assert.equal(timestamp(new Date('2026-08-28T10:20:30.123Z')),'2026-08-28T10-20-30-123Z');assert.match(path.basename(safeBackupPath({directory:'backups',fileName:'sti-vio-log-test.dump'})),/\.dump$/);assert.throws(()=>safeBackupPath({fileName:'../secret.dump'}),/simple/)});
test('connection URL becomes libpq environment without entering command arguments',()=>{const env=connectionEnvironment({DATABASE_URL:'postgresql://app:p%40ss@db.example.test:5433/vio?sslmode=require'});assert.equal(env.PGHOST,'db.example.test');assert.equal(env.PGDATABASE,'vio');assert.equal(env.PGPASSWORD,'p@ss');assert.equal(env.PGSSLMODE,'require')});
test('individual database settings map to libpq environment',()=>{const env=connectionEnvironment({DB_HOST:'localhost',DB_PORT:'5432',DB_NAME:'vio',DB_USER:'app',DB_PASSWORD:'private',DB_SSL:'disable'});assert.equal(env.PGDATABASE,'vio');assert.equal(env.PGSSLMODE,'disable')});
