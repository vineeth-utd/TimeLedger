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

export function setTheme(theme) {
  const dark = theme === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111827' : '#ffffff')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Preference just won't persist.
  }
}
