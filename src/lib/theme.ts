const KEY = 'skillbloom-theme'

export type Theme = 'light' | 'dark'

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be blocked in some browsers, so fall back to the device setting
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // If storage is blocked, the choice still applies for this visit
  }
  applyTheme(theme)
  window.dispatchEvent(new Event('theme-change'))
}

export function initTheme() {
  applyTheme(getTheme())
}