import { readFileSync } from 'node:fs'

export function readPortalStyles() {
  return ['portal-system.css', 'portal-overrides.css', 'login-page.css'].map((name) => readFileSync(new URL(`../../src/styles/${name}`, import.meta.url), 'utf8')).join('\n')
}
