'use client'

import { useEffect } from 'react'
import { applyStoredTheme } from '@/lib/theme'

// Restores the saved theme after hydration (see applyStoredTheme). Renders nothing.
export default function ThemeSync() {
  useEffect(() => {
    applyStoredTheme()
  }, [])
  return null
}
