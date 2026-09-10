import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const policySource = await readFile(new URL('../src/components/PublicPolicyPage.jsx', import.meta.url), 'utf8')
const robotsSource = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8')
const sitemapSource = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8')

test('public legal pages cover privacy, authorized access, and contact guidance', () => {
  assert.match(policySource, /Privacy Policy/)
  assert.match(policySource, /Terms of Use/)
  assert.match(policySource, /Who can access information/)
  assert.match(policySource, /Account security/)
  assert.match(policySource, /Discipline Office/)
})

test('crawler files expose public information without advertising protected areas', () => {
  assert.match(robotsSource, /Disallow: \/student\//)
  assert.match(robotsSource, /Disallow: \/admin\//)
  assert.match(robotsSource, /Sitemap: https:\/\/sti-vio-log\.vercel\.app\/sitemap\.xml/)
  assert.match(sitemapSource, /<loc>https:\/\/sti-vio-log\.vercel\.app\/privacy<\/loc>/)
  assert.match(sitemapSource, /<loc>https:\/\/sti-vio-log\.vercel\.app\/terms<\/loc>/)
  assert.doesNotMatch(sitemapSource, /\/student\//)
})
