import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const studentDashboard = await readFile(new URL('../src/components/StudentDashboard.jsx', import.meta.url), 'utf8')
const passwordChange = await readFile(new URL('../src/components/PasswordChangeRequired.jsx', import.meta.url), 'utf8')
const icon = await readFile(new URL('../src/components/PortalIcon.jsx', import.meta.url), 'utf8')
const foundation = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const appCss = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
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
  assert.match(app, /useState\(\(\) => readDocumentTheme\(document\)\)/)
  assert.match(app, /applyTheme\(nextTheme, document, window\.localStorage\)/)
  assert.doesNotMatch(app, /data-theme=\{theme\}/)
  assert.match(html, /<script src="\/theme-bootstrap\.js"><\/script>/)
  assert.match(bootstrap, /let theme = 'light'[\s\S]*localStorage\.getItem\('sti-vio-log-theme'\)[\s\S]*document\.documentElement\.dataset\.theme = theme/)
  assert.match(bootstrap, /document\.documentElement\.style\.colorScheme = theme/)
  assert.match(bootstrap, /meta\[name="theme-color"\]/)
})

test('theme controls remain named and available in both public and portal shells', () => {
  assert.equal((app.match(/aria-label=\{`Switch to \$\{theme === 'dark' \? 'light' : 'dark'\} mode`\}/g) || []).length, 2)
  assert.match(app, /aria-pressed=\{theme === 'dark'\}/)
  assert.equal((app.match(/title=\{`Switch to \$\{theme === 'dark' \? 'light' : 'dark'\} mode`\}/g) || []).length, 2)
  assert.doesNotMatch(app, /theme-toggle-label/)
  assert.doesNotMatch(app, /\{theme === 'dark' \? 'Light(?: mode)?' : 'Dark(?: mode)?'\}/)
  assert.match(app, /className="theme-toggle auth-theme-toggle"/)
  assert.match(icon, /sun:/)
  assert.match(icon, /moon:/)
})

test('theme transition animates colors directly without transparent page snapshots', () => {
  assert.match(app, /classList\.add\('theme-transitioning'\)/)
  assert.match(app, /classList\.remove\('theme-transitioning'\)/)
  assert.match(app, /clearTimeout\(themeTransitionTimerRef\.current\)[\s\S]*classList\.add\('theme-transitioning'\)/)
  assert.match(app, /prefers-reduced-motion: reduce/)
  assert.match(foundation, /\.theme-transitioning \*::after\s*\{[^}]*transition-duration:\s*160ms !important;/s)
  assert.match(foundation, /transition-property:\s*background-color, border-color, color, fill, stroke, box-shadow !important;/)
  const transitionStart = foundation.indexOf('.theme-transitioning')
  const transitionRule = foundation.slice(transitionStart, foundation.indexOf('}', transitionStart) + 1)
  assert.doesNotMatch(transitionRule, /\b(?:width|height|margin|padding|top|left|right|bottom|grid|transform)\b/)
  assert.doesNotMatch(app, /startViewTransition/)
  assert.doesNotMatch(foundation, /::view-transition-(?:old|new)/)
  assert.doesNotMatch(`${foundation}\n${portal}`, /transition\s*:\s*all\b|transition-all/)
})

test('theme image layers preload and crossfade without a blank frame', () => {
  assert.match(html, /rel="preload" as="image"[^>]+sti-global-city-building-web\.jpg/)
  assert.match(html, /rel="preload" as="image"[^>]+sti-global-city-building-night\.jpg/)
  assert.match(appCss, /\.theme-transitioning \.login-campus-image\s*\{[^}]*opacity 160ms ease-out/s)
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

test('portal navigation keeps transparent branding and a fixed navy palette in both themes', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  assert.match(app, /import stiVioLogLogoTransparent from '\.\/assets\/sti-logo-web-transparent\.png'/)
  assert.match(app, /className="brand-logo"\s+src=\{stiVioLogLogoTransparent\}/s)
  assert.match(app, /className="mobile-brand-logo" src=\{stiVioLogLogoTransparent\}/)
  assert.doesNotMatch(app, /brand-logo-(?:light|dark)|mobile-brand-logo-(?:light|dark)/)
  assert.match(guard, /Authenticated navigation is deliberately theme-invariant/)
  assert.match(guard, /\.app-shell:not\(\.auth-shell\) \.sidebar,[^}]*background: #07345f/s)
  assert.match(guard, /:root\[data-theme='dark'\] \.sidebar \.brand\s*\{[^}]*background: transparent !important/s)
  assert.match(guard, /:root\[data-theme='dark'\] \.sidebar \.nav-item\.active,[^}]*background: #0878df/s)
  assert.match(guard, /\.profile-menu-trigger \.account-summary strong,[\s\S]*color:var\(--text-primary\)/)
  assert.match(guard, /\.profile-menu-trigger \.account-summary small,[\s\S]*color:var\(--text-secondary\)/)
  assert.match(guard, /\.officer-name/)
})

test('dark QR attendance qualifiers use semantic dark pills', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  assert.match(guard, /\.record-fields \.record-field-label small\s*\{[^}]*background:var\(--surface-interactive\)[^}]*color:var\(--text-secondary\)/s)
  assert.match(guard, /label:has\(\[name='condition'\]\) \.record-field-label small\s*\{[^}]*background:var\(--status-warning-surface\)[^}]*color:var\(--status-warning-text\)/s)
})

test('dark student routes cannot retain legacy light cards or low-contrast text', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  for (const selector of ['.page-intro', '.violation-card', '.violation-summary', ".violation-summary[aria-expanded='true']", '.violation-details', '.service-progress', '.violations-empty', '.qr-display-card', '.qr-guidance > div', '.student-qr-frame', '.assignment-list', '.session-list', '.dtr-filters input', '.skeleton']) {
    assert.match(guard, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(guard, /\.page-intro,[^}]*background:var\(--surface-raised\)/s)
  assert.match(guard, /\.violations-page \.violation-summary\[aria-expanded='true'\]\s*\{[^}]*background:var\(--surface-interactive\)/s)
  assert.match(guard, /\.violation-details\s*\{[^}]*background:var\(--surface-nested\)/s)
  assert.match(guard, /\.student-qr-frame\s*\{[^}]*background:var\(--surface-nested\)/s)
  assert.match(guard, /\.mobile-bottom-nav button\.active,[^}]*background:#076dcc !important;[^}]*color:#ffffff !important;/s)
})

test('dark student dashboard standing notices use semantic status surfaces', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  assert.match(guard, /:is\(\.student-standing-alert,\.standing-detail\)\s*\{[^}]*background:var\(--status-warning-surface\)[^}]*color:var\(--status-warning-text\)/s)
  assert.match(guard, /:is\(\.student-standing-alert,\.standing-detail\):has\(:is\(\.offense-red,\.offense-critical\)\)\s*\{[^}]*background:var\(--status-danger-surface\)[^}]*color:var\(--status-danger-text\)/s)
  const themedStanding = guard.slice(guard.indexOf('Dashboard standing states'), guard.indexOf('QR attendance field qualifiers'))
  assert.doesNotMatch(themedStanding, /#fff(?:1f3|2f3)|#ffd6db|#9e2434|#80515a/i)
})

test('dark student profile themes its hero, fields, dividers, and help footer', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  assert.match(guard, /\.profile-card \.profile-hero\s*\{[^}]*background:var\(--surface-nested\)[^}]*color:var\(--text-primary\)/s)
  assert.match(guard, /\.profile-card \.profile-hero :is\(\.eyebrow,h2\)[^}]*color:var\(--text-primary\)/s)
  assert.match(guard, /\.profile-card \.profile-field \.profile-value-missing[^}]*color:var\(--text-muted\)/s)
  assert.match(guard, /\.profile-card \.profile-help\s*\{[^}]*background:var\(--surface-nested\)[^}]*color:var\(--text-secondary\)/s)
})

test('dark dashboard clearance status uses semantic pending and ready states', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  assert.match(studentDashboard, /clearance-state clearance-state--ready/)
  assert.match(studentDashboard, /clearance-state clearance-state--pending/)
  assert.match(guard, /\.clearance-summary-card \.clearance-state\s*\{[^}]*background:var\(--status-warning-surface\)[^}]*color:var\(--status-warning-text\)/s)
  assert.match(guard, /\.clearance-summary-card \.clearance-state--ready\s*\{[^}]*background:var\(--status-success-surface\)[^}]*color:var\(--status-success-text\)/s)
})

test('required password change uses responsive theme-specific campus imagery', () => {
  assert.match(passwordChange, /sti-global-city-building-web\.jpg/)
  assert.match(passwordChange, /sti-global-city-building-night\.jpg/)
  assert.match(passwordChange, /password-change-page/)
  assert.match(passwordChange, /login-campus-image--day/)
  assert.match(passwordChange, /login-campus-image--night/)
  assert.match(portal, /\.password-change-page \.login-campus-image\s*\{[^}]*object-fit:cover/s)
  assert.match(portal, /@media \(max-width:767px\)[\s\S]*\.password-change-page \.password-change-intro/)
})

test('dark registration credentials and review surfaces use semantic tokens', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  for (const selector of ['.password-change-card .password-requirements', '.student-onboarding .password-requirements', '.app-modal .registration-pending', '.registration-review-list > article', '.registration-review-drawer dl', '.registration-review-drawer mark']) {
    assert.match(guard, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(guard, /\.app-modal \.registration-pending\s*\{[^}]*background:var\(--status-warning-surface\)/s)
  assert.match(guard, /\.registration-pending button:disabled\s*\{[^}]*background:var\(--control-disabled-background\)[^}]*color:var\(--text-muted\)/s)
  assert.match(guard, /\.registration-review-drawer mark\s*\{[^}]*background:var\(--status-warning-surface\)/s)
})

test('dark clearance covers pending, ready, blocked, history, and empty states', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  assert.match(guard, /\.clearance-pending \.clearance-status-mark\s*\{[^}]*background:var\(--status-info-surface\)[^}]*color:var\(--status-info-text\)/s)
  assert.match(guard, /\.clearance-cleared \.clearance-status-mark,[\s\S]*\.clearance-ready\s*\{[^}]*background:var\(--status-success-surface\)/s)
  assert.match(guard, /\.clearance-not-eligible \.clearance-status-mark,[\s\S]*\.clearance-requirements ul\s*\{[^}]*background:var\(--status-warning-surface\)/s)
  assert.match(guard, /\.clearance-empty p[^}]*color:var\(--text-secondary\)/s)
})

test('dark onboarding and approval state pairs meet WCAG AA contrast', () => {
  const pairs = [
    ['#9bd0ff', '#163b5c', 4.5, 'pending approval'],
    ['#7de2af', '#123d31', 4.5, 'ready and valid'],
    ['#ff9ba7', '#48252d', 4.5, 'invalid password'],
    ['#ffd870', '#443817', 4.5, 'temporary credential warning'],
    ['#93a9bc', '#0b1825', 4.5, 'disabled control'],
  ]
  for (const [foreground, background, minimum, label] of pairs) {
    assert.ok(contrast(foreground, background) >= minimum, `${label} must be at least ${minimum}:1`)
  }
})

test('dark student status colors meet WCAG AA contrast', () => {
  const pairs = [
    ['#f2f7fb', '#10263a', 4.5, 'student card primary text'],
    ['#b9cad9', '#10263a', 4.5, 'student card secondary text'],
    ['#9bd0ff', '#163b5c', 4.5, 'student information badge'],
    ['#ffd870', '#443817', 4.5, 'student warning badge'],
    ['#ff9ba7', '#48252d', 4.5, 'student grave badge'],
    ['#7de2af', '#123d31', 4.5, 'student success badge'],
    ['#ffffff', '#076dcc', 4.5, 'active mobile navigation'],
  ]
  for (const [foreground, background, minimum, label] of pairs) {
    assert.ok(contrast(foreground, background) >= minimum, `${label} must be at least ${minimum}:1`)
  }
})

test('dark public policy pages keep their surfaces and text on one semantic palette', () => {
  const guard = portal.slice(portal.lastIndexOf('FINAL THEME CASCADE GUARD'))
  for (const selector of ['.public-policy-page', '.public-policy-brand', '.public-policy-card', '.public-policy-intro', '.public-policy-sections', '.public-policy-footer']) {
    assert.match(guard, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(guard, /\.public-policy-page\s*\{[^}]*background:var\(--surface-canvas\)[^}]*color:var\(--text-primary\)/s)
  assert.match(guard, /\.public-policy-card\s*\{[^}]*background:var\(--surface-raised\)[^}]*color:var\(--text-primary\)/s)
  assert.match(guard, /\.public-policy-intro\s*\{[^}]*background:var\(--surface-nested\)/s)
  assert.match(guard, /\.public-policy-sections p\s*\{[^}]*color:var\(--text-secondary\)/s)
  assert.match(guard, /\.public-policy-footer\s*\{[^}]*background:var\(--surface-nested\)/s)
  assert.match(guard, /\.public-policy-footer nav button\s*\{[^}]*color:var\(--link-color\)/s)
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
