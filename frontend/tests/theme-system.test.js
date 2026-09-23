import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const icon = await readFile(new URL('../src/components/PortalIcon.jsx', import.meta.url), 'utf8')
const foundation = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const portal = await readFile(new URL('../src/styles/portal-system.css', import.meta.url), 'utf8')
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
const bootstrap = await readFile(new URL('../public/theme-bootstrap.js', import.meta.url), 'utf8')

function hexToRgb(hex) {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
}

function luminance(hex) {
  const channels = hexToRgb(hex).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('appearance preference defaults to the light reference, persists, and updates browser color scheme', () => {
  assert.match(app, /localStorage\.getItem\('sti-vio-log-theme'\)/)
  assert.match(app, /if \(savedTheme === 'light' \|\| savedTheme === 'dark'\) return savedTheme\s+return 'light'/)
  assert.match(app, /document\.documentElement\.dataset\.theme = theme/)
  assert.match(app, /document\.documentElement\.style\.colorScheme = theme/)
  assert.match(app, /localStorage\.setItem\('sti-vio-log-theme', theme\)/)
  assert.match(app, /meta\[name="theme-color"\]/)
  assert.match(html, /<script src="\/theme-bootstrap\.js"><\/script>/)
  assert.match(bootstrap, /localStorage\.getItem\('sti-vio-log-theme'\)[\s\S]*document\.documentElement\.dataset\.theme = theme/)
})

test('theme controls remain named and available in both public and portal shells', () => {
  assert.equal((app.match(/aria-label=\{`Switch to \$\{theme === 'dark' \? 'light' : 'dark'\} mode`\}/g) || []).length, 2)
  assert.match(app, /aria-pressed=\{theme === 'dark'\}/)
  assert.match(app, /title=\{`Switch to \$\{theme === 'dark' \? 'light' : 'dark'\} mode`\}/)
  assert.match(app, /theme-toggle-label">\{theme === 'dark' \? 'Light' : 'Dark'\}/)
  assert.match(app, /className="theme-toggle auth-theme-toggle"/)
  assert.match(icon, /sun:/)
  assert.match(icon, /moon:/)
})

test('dark mode is token driven and covers core portal, form, table, modal, and mobile surfaces', () => {
  assert.match(foundation, /:root\[data-theme='dark'\]/)
  for (const token of ['--surface-canvas', '--surface-raised', '--surface-nested', '--surface-interactive', '--text-primary', '--text-secondary', '--text-muted', '--border-subtle', '--link-color', '--control-background', '--modal-surface', '--chat-canvas', '--message-incoming-surface', '--message-outgoing-surface']) {
    assert.match(foundation, new RegExp(token))
  }
  for (const selector of ['.topbar', 'input,select,textarea', 'table,thead,tbody,tr,th,td', '.modal-content', '.mobile-bottom-nav', '.auth-shell']) {
    assert.match(portal, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(portal, /@media \(prefers-reduced-motion: reduce\)/)
})

test('dark semantic text and state colors meet WCAG AA contrast', () => {
  const pairs = [
    ['#f2f7fb', '#071421', 4.5, 'primary text on canvas'],
    ['#f2f7fb', '#10263a', 4.5, 'primary text on raised surface'],
    ['#b9cad9', '#10263a', 4.5, 'secondary text on raised surface'],
    ['#93a9bc', '#071421', 4.5, 'muted text on canvas'],
    ['#79c2ff', '#10263a', 4.5, 'links on raised surface'],
    ['#91a8bc', '#091b2c', 4.5, 'placeholder text in controls'],
    ['#7de2af', '#123d31', 4.5, 'success state'],
    ['#ffd870', '#443817', 4.5, 'warning state'],
    ['#ff9ba7', '#48252d', 4.5, 'danger state'],
    ['#9bd0ff', '#163b5c', 4.5, 'information state'],
    ['#f2f7fb', '#18354f', 4.5, 'incoming message text'],
    ['#ffffff', '#1769aa', 4.5, 'outgoing message text'],
    ['#a9bdcf', '#18354f', 4.5, 'message metadata'],
  ]
  for (const [foreground, background, minimum, label] of pairs) {
    assert.ok(contrast(foreground, background) >= minimum, `${label} must be at least ${minimum}:1`)
  }
})

test('dark validation and destructive controls share danger tokens', () => {
  for (const selector of ['.error-message', '.field-error', '.registration-field-error', ".password-requirements .invalid", '.danger-text', "[aria-invalid='true']", '.account-action-notice--danger', '.danger-button']) {
    assert.match(portal, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(portal, /\.error-message\s*\{[^}]*var\(--status-danger-surface\)[^}]*var\(--status-danger-text\)/s)
  assert.match(portal, /\.danger-button:hover:not\(:disabled\)[\s\S]*background:var\(--color-danger\)/)
  assert.equal((portal.match(/button:not\(\[type='button'\]\):not\(\.danger-button\):last-child/g) || []).length, 2)
  assert.doesNotMatch(portal, /button:not\(\[type='button'\]\):last-child\s*\{[^}]*background:var\(--color-primary\)/)
})

test('dark notifications and account controls cannot fall back to light surfaces', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  for (const selector of ['.notifications-hero', '.notification-list > article', '.notification-heading > span', '.account-directory-panel', '.account-directory-search', '.account-action-results > button', '.account-action-form', '.selected-account-summary', '.account-result-avatar', '.monitoring-slide .table-wrap thead th']) {
    assert.match(guard, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(guard, /\.notifications-hero\s*\{[^}]*background:var\(--surface-raised\)/s)
  assert.match(guard, /\.account-directory-panel,\.account-action-form\)\s*\{[^}]*background:var\(--surface-raised\)/s)
  assert.match(guard, /\.selected-account-summary\s*\{[^}]*background:var\(--surface-nested\)/s)
  assert.match(guard, /\.account-action-results > button\.selected\s*\{[^}]*background:var\(--surface-selected\)/s)
  const themedControls = guard.slice(0, guard.indexOf('Deliberately light for printing/scanning'))
  assert.doesNotMatch(themedControls, /background(?:-color)?:\s*(?:white|#fff(?:fff)?|#fbfdff|#f8fbfe|#f9fbfd|#edf5fd|#eaf4ff)\b/i)
})

test('dark portaled dialogs, badges, profile controls, and disabled actions use semantic surfaces', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  for (const selector of ['.student-form-grid', '.account-action-notice', '.registration-pending', '.compact-stepper button', '.registration-review-actions', '.record-detail-drawer dl', '.record-detail-drawer > section', '.status-badge', '.profile-menu-trigger', '.profile-menu-chevron', '.profile-menu-popover header', '.main-panel button:disabled']) {
    assert.match(guard, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(guard, /\.app-modal :is\(\.student-form-grid,[^}]*background:var\(--surface-nested\)/s)
  assert.match(guard, /\.app-modal \.account-action-notice\s*\{[^}]*background:var\(--status-info-surface\)/s)
  assert.match(guard, /\.app-modal :is\(button,[^}]*:disabled\s*\{[^}]*background:var\(--control-disabled-background\)/s)
  assert.match(guard, /\.status-badge\s*\{[^}]*background:var\(--status-info-surface\)/s)
  assert.match(guard, /\.profile-menu-trigger[^}]*background:var\(--surface-interactive\)/s)
  assert.match(guard, /\.record-detail-drawer > section\s*\{[^}]*background:var\(--surface-nested\)/s)
})

test('dark surfaces cover metrics, quick actions, tables, dialogs, messaging, QR, and status states', () => {
  for (const selector of ['.management-metric', '.dashboard-quick-actions', '.qr-stage-card', '.app-modal-header', '.officer-directory', '.certificate-student-card', '.conversation-list', '.message-bubble', '.auth-card.login-card', '.progress-ring', '.status-complete', '.error-message']) {
    assert.match(portal, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(portal, /\.management-metric[^}]*background:var\(--surface-raised\)/s)
  assert.match(portal, /\.dashboard-quick-actions[^}]*background: var\(--surface-interactive\)/s)
})

test('the dark cascade guard follows every legacy route rule and contains no accidental light surface', () => {
  const guardMarker = portal.lastIndexOf('FINAL THEME CASCADE GUARD')
  assert.ok(guardMarker > portal.lastIndexOf('Reference-led dashboard composition'))
  const guard = portal.slice(guardMarker)
  assert.match(guard, /\.app-modal--drawer \.app-modal-header[\s\S]*var\(--modal-header-surface\)/)
  assert.match(guard, /\.message-bubble-row\.mine \.message-bubble[\s\S]*var\(--message-outgoing-surface\)/)
  assert.match(guard, /\.auth-shell \.auth-card\.login-card[\s\S]*var\(--surface-overlay\)/)
  const themeableGuard = guard.split('Deliberately light for printing/scanning')[0]
  assert.doesNotMatch(themeableGuard, /background(?:-color)?:\s*(?:white|#fff(?:fff)?|#fbfdff|#f8fbfe)\b/i)
})

test('certificate and QR light canvases are the only explicit dark-theme exceptions', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  const exception = guard.slice(guard.indexOf('Deliberately light for printing/scanning'))
  for (const selector of ['.certificate-preview', '.clearance-certificate', '.qr-mini', '.qr-display-card canvas', '.qr-display-card img']) {
    assert.match(exception, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(exception, /color-scheme:\s*light/)
})
