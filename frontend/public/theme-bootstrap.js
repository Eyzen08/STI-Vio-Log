/* global localStorage, document */
(() => {
  try {
    const theme = localStorage.getItem('sti-vio-log-theme') === 'dark' ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#071421' : '#075aab'
  } catch {
    document.documentElement.dataset.theme = 'light'
  }
})()
