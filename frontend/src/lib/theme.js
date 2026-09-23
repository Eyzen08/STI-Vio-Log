export const THEME_STORAGE_KEY = 'sti-vio-log-theme'

export function normalizeTheme(value) {
  return value === 'dark' ? 'dark' : 'light'
}

export function readDocumentTheme(documentRef = document) {
  return normalizeTheme(documentRef.documentElement.dataset.theme)
}

export function applyTheme(theme, documentRef = document, storageRef = window.localStorage) {
  const nextTheme = normalizeTheme(theme)
  const root = documentRef.documentElement

  root.dataset.theme = nextTheme
  root.style.colorScheme = nextTheme
  documentRef.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    nextTheme === 'dark' ? '#071421' : '#075aab',
  )

  try {
    storageRef?.setItem(THEME_STORAGE_KEY, nextTheme)
  } catch {
    // Theme still applies when storage is unavailable or blocked.
  }

  return nextTheme
}
