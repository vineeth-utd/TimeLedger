import { useSyncExternalStore } from 'react'

import { THEME_STORAGE_KEY } from '@/lib/themeScript'

function subscribe(onChange) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

const getSnapshot = () => document.documentElement.classList.contains('dark')
const getServerSnapshot = () => false

// The <html> class (set before hydration by themeInitScript) is the single source of truth.
export function useIsDark() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// DOM side of a theme change (no persistence). Mirrors the inline themeInitScript.
export function applyTheme(theme) {
  const dark = theme === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111827' : '#ffffff')
}

export function setTheme(theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Preference just won't persist.
  }
}

// Re-applies the saved preference (or the system one), like the inline script does before first
// paint. React 19 clears every attribute of <html> if the root is re-rendered on the client, which
// would drop the `dark` class while the saved preference is still intact.
export function applyStoredTheme() {
  let theme = null
  try {
    theme = localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    // Storage unavailable: fall back to the system preference.
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  applyTheme(theme)
}
