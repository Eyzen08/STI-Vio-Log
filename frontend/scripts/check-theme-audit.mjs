// Assert the audit detects both themes and composites translucent foregrounds.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { auditThemeColors } from './lib/themeAudit.mjs'
const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch({ headless:true, channel:'msedge' })
try {
  const page = await browser.newPage()
  await page.setContent('<style>body{background:white;color:#17345b}input{background:white;border:1px solid #ddd}input::placeholder{color:#aaa}</style><p id="good">Readable</p><p id="bad" style="color:#aaa">Unreadable</p><p id="alpha" style="color:rgba(0,0,0,.15)">Faint</p><input placeholder="Faint placeholder">')
  let result = await page.evaluate(auditThemeColors)
  assert.ok(result.findings.some(item => item.selector.includes('#bad') && item.issue === 'text contrast'))
  assert.ok(result.findings.some(item => item.selector.includes('#alpha') && item.issue === 'text contrast'))
  assert.ok(result.findings.some(item => item.issue === 'placeholder contrast'))
  assert.ok(result.findings.some(item => item.issue === 'control border contrast'))
  assert.ok(!result.findings.some(item => item.selector.includes('#good')))
  await page.setContent('<style>body{background:#071421;color:#f2f7fb}</style><p id="good">Readable</p><div id="leak" style="background:white;color:black">Light leak</div><div class="certificate-preview" style="background:white;color:black">Print paper</div>')
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  result = await page.evaluate(auditThemeColors)
  assert.ok(result.findings.some(item => item.selector.includes('#leak') && item.issue === 'light surface'))
  assert.ok(!result.findings.some(item => item.selector.includes('certificate-preview') || item.selector.includes('#good')))
  console.log('PASS: audit detects light/dark leaks, transparent text, placeholders and control boundaries while preserving printed paper.')
} finally { await browser.close() }
