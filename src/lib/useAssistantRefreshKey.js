'use client'

import { useEffect, useState } from 'react'
import { DATA_CHANGED_EVENT } from '@/lib/assistantClient'

// A counter that increments whenever the assistant changes TimeLedger data. Add it to a page's
// fetch-effect dependencies so the visible data re-fetches (filters and modals are kept).
export default function useAssistantRefreshKey() {
  const [key, setKey] = useState(0)
  useEffect(() => {
    const onChange = () => setKey((k) => k + 1)
    window.addEventListener(DATA_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange)
  }, [])
  return key
}
