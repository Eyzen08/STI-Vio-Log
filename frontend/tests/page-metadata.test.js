import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { metadataForRoute } from '../src/lib/pageMetadata.js'

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('browser titles format generated route labels and preserve the brand', () => {
  assert.equal(metadataForRoute('/admin/custom', 'account recovery and lock').title, 'Account Recovery and Lock | STI Vio-Log')
})

test('public routes receive specific searchable metadata', () => {
  assert.equal(metadataForRoute('/').title, 'STI Vio-Log | STI Global City')
  assert.equal(metadataForRoute('/').robots, 'index, follow')
  assert.equal(metadataForRoute('/privacy').title, 'Privacy Notice | STI Vio-Log')
  assert.equal(metadataForRoute('/terms').robots, 'index, follow')
  assert.match(metadataForRoute('/login').description, /secure STI Vio-Log portal/)
})

test('authenticated and unknown routes are excluded from indexing', () => {
  assert.equal(metadataForRoute('/student/violations', 'My Violations').robots, 'noindex, nofollow')
  assert.equal(metadataForRoute('/not-real').robots, 'noindex, nofollow')
})

test('application shell includes canonical social and icon metadata', () => {
  assert.match(html, /property="og:url" content="https:\/\/stiviolog\.com\/"/)
  assert.match(html, /property="og:image" content="https:\/\/stiviolog\.com\/social-preview\.jpg\?v=20261021-2"/)
  assert.match(html, /name="twitter:image" content="https:\/\/stiviolog\.com\/social-preview\.jpg\?v=20261021-2"/)
  assert.match(html, /property="og:image:alt" content="STI Vio-Log: STI Global City Discipline Office Portal\. Records\. Service\. Clearance\. STI Global City campus at night\. stiviolog\.com\."/)
  assert.match(html, /name="twitter:card" content="summary_large_image"/)
  assert.match(html, /rel="canonical" href="https:\/\/stiviolog\.com\/"/)
  assert.match(html, /rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png"/)
  assert.doesNotMatch(html, /rel="icon" type="image\/svg\+xml"/)
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/)
})

test('search discovery URLs use the canonical custom domain', async () => {
  const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8')
  assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]), [
    'https://stiviolog.com/',
    'https://stiviolog.com/login',
    'https://stiviolog.com/privacy',
    'https://stiviolog.com/terms',
  ])
  assert.match(robots, /^Sitemap: https:\/\/stiviolog\.com\/sitemap\.xml$/m)
})
