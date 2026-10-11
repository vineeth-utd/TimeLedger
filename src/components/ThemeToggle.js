'use client'

import { Moon, Sun } from 'lucide-react'
import { setTheme, useIsDark } from '@/lib/theme'

export default function ThemeToggle({ className = '' }) {
  const isDark = useIsDark()

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`p-2 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors ${className}`}
    >
      {isDark ? <Sun className="w-5 h-5" strokeWidth={2} aria-hidden="true" /> : <Moon className="w-5 h-5" strokeWidth={2} aria-hidden="true" />}
    </button>
  )
}
