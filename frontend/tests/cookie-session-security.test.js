import test from 'node:test'
import assert from 'node:assert/strict'
import {installMutationRequestGuard} from '../src/lib/api.js'
import fs from 'node:fs'

test('transport strips bearer credentials and uses credentialed cookie requests',async()=>{
 let received;const response={clone(){return this}};const target={fetch:async(input,options)=>{received={input,options};return response}}
 installMutationRequestGuard(target)
 await target.fetch('https://api.example.test/api/health',{headers:{Authorization:'Bearer exposed'}})
 assert.equal(received.options.headers.has('Authorization'),false)
 assert.equal(received.options.credentials,'include')
})

test('production API requests use the same-origin Vercel proxy',()=>{
 const source=fs.readFileSync(new URL('../src/lib/api.js',import.meta.url),'utf8')
 assert.match(source,/import\.meta\.env\?\.PROD \? ''/)
})
