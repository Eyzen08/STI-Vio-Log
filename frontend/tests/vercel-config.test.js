import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Vercel serves client-side routes through the application shell',()=>{const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));assert.deepEqual(config.rewrites,[{source:'/(.*)',destination:'/index.html'}])})
