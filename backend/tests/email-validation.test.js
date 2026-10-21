const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidEmail } = require('../src/utils/validators');

test('email validation preserves supported addresses within the database limit', () => {
  for (const value of ['student@gmail.com', 'office+tag@dept.example.test', 'é@exämple.com', 'a@..b', 'a@b..', 'a@...', 'a'.repeat(251) + '@b.c']) {
    assert.equal(isValidEmail(value), true, value);
  }
});

test('email validation rejects malformed addresses and whitespace', () => {
  for (const value of ['', '@b.c', 'a@', 'a@@b.c', 'a.b@c', 'a@.b', 'a@b.', 'a@..', ' a@b.c', 'a@b.c ', 'a@b.c\n', 'a\tb@c.d', 'a@b\u00a0.c']) {
    assert.equal(isValidEmail(value), false, JSON.stringify(value));
  }
});

test('email validation rejects non-string input', () => {
  for (const value of [undefined, null, 7, true, {}, [], new String('a@b.c')]) {
    assert.equal(isValidEmail(value), false);
  }
});

test('email validation bounds oversized and adversarial repeated separators', () => {
  assert.equal(isValidEmail('a'.repeat(252) + '@b.c'), false);
  assert.equal(isValidEmail('!@!.' + '!.'.repeat(100000) + '@'), false);
  assert.equal(isValidEmail('!@!.' + '!.'.repeat(120) + '@'), false);
});
