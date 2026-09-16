const test = require('node:test');
const assert = require('node:assert/strict');

test('database config accepts an escaped PEM CA while retaining certificate verification', () => {
  const previous = { DB_SSL: process.env.DB_SSL, DB_SSL_CA: process.env.DB_SSL_CA };
  process.env.DB_SSL = 'require';
  process.env.DB_SSL_CA = '-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----';
  const pg = require('pg');
  const OriginalPool = pg.Pool;
  let captured;
  pg.Pool = class { constructor(config) { captured = config; } };
  const modulePath = require.resolve('../src/config/database');
  delete require.cache[modulePath];
  try {
    require(modulePath);
    assert.equal(captured.ssl.rejectUnauthorized, true);
    assert.equal(captured.ssl.ca, '-----BEGIN CERTIFICATE-----\nexample\n-----END CERTIFICATE-----');
  } finally {
    pg.Pool = OriginalPool;
    delete require.cache[modulePath];
    if (previous.DB_SSL === undefined) delete process.env.DB_SSL; else process.env.DB_SSL = previous.DB_SSL;
    if (previous.DB_SSL_CA === undefined) delete process.env.DB_SSL_CA; else process.env.DB_SSL_CA = previous.DB_SSL_CA;
  }
});
