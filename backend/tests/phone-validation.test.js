const test=require('node:test');
const assert=require('node:assert/strict');
const {isValidPhone,normalizePhone}=require('../src/utils/validators');

test('Philippine mobile numbers normalize to E.164',()=>{
  assert.equal(normalizePhone('09171234567'),'+639171234567');
  assert.equal(normalizePhone('+63 917 123 4567'),'+639171234567');
  assert.equal(isValidPhone('+639171234567'),true);
});

test('non-mobile, incomplete, and letter-bearing phone values are rejected',()=>{
  for(const value of ['917123456','08171234567','+63917ABC4567','1234567',''])assert.equal(isValidPhone(value),false);
});
