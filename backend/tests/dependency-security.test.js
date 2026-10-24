const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { gzipSync } = require('node:zlib');
const express = require('express');
const nodemailer = require('nodemailer');

// Keep recipients inside comments/quotes from becoming SMTP destinations.
for (const [name, input, recipient] of [
  ['nested comment', 'Student (x(y) <other@other.example>) <student@school.example>', 'student@school.example'],
  ['group comment', 'Class: (a; <other@other.example>) <student@school.example>;', 'student@school.example'],
  // SMTP encoding replaces angle brackets inside quoted local parts with spaces.
  ['quoted local part', '<"a@other.example>"@school.example>', '"a@other.example "@school.example'],
]) {
  test(`SMTP envelope preserves the intended recipient with a ${name}`, async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const result = await transport.sendMail({ from: 'office@school.example', to: input, subject: 'Fixture', text: 'Fixture' });
    assert.deepEqual(result.envelope.to, [recipient]);
  });
}

test('compressed JSON with trailing bytes does not cause an uncaught decoder error', { timeout: 5000 }, async (t) => {
  const app = express();
  app.use(express.json({ limit: '128kb' }));
  app.post('/', (req, res) => res.json(req.body));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  await once(server, 'listening');

  // Let the finished gzip decoder see a bounded suffix after its valid frame.
  const payload = Buffer.concat([gzipSync('{"ok":true}'), Buffer.from([0]), Buffer.alloc(100 * 1024, 0x58)]);
  const response = await new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port: server.address().port, method: 'POST', agent: false,
      headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': payload.length },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    request.on('error', reject);
    request.setTimeout(2000, () => request.destroy(new Error('Local parser fixture timed out')));
    request.end(payload);
  });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  await new Promise(resolve => setTimeout(resolve, 200));
});
