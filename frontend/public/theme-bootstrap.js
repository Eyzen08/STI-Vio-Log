/* global localStorage, document */
(() => {
  let theme = 'light'

  try {
    theme = localStorage.getItem('sti-vio-log-theme') === 'dark' ? 'dark' : 'light'
  } catch { /* Storage can be blocked; light remains the safe default. */ }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#071421' : '#075aab',
  )
})()
