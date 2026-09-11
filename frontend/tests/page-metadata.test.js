import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { metadataForRoute } from '../src/lib/pageMetadata.js'

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('public routes receive specific searchable metadata', () => {
  assert.equal(metadataForRoute('/privacy').title, 'Privacy Policy | STI Vio-Log')
  assert.equal(metadataForRoute('/terms').robots, 'index, follow')
  assert.match(metadataForRoute('/login').description, /secure STI Vio-Log portal/)
})

test('authenticated and unknown routes are excluded from indexing', () => {
  assert.equal(metadataForRoute('/student/violations', 'My Violations').robots, 'noindex, nofollow')
  assert.equal(metadataForRoute('/not-real').robots, 'noindex, nofollow')
})

test('application shell includes canonical social and icon metadata', () => {
  assert.match(html, /property="og:image" content="https:\/\/sti-vio-log\.vercel\.app\/social-preview\.jpg"/)
  assert.match(html, /name="twitter:card" content="summary_large_image"/)
  assert.match(html, /rel="canonical"/)
  assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png"/)
  assert.doesNotMatch(html, /rel="icon" type="image\/svg\+xml"/)
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/)
})
