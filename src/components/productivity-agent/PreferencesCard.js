'use client'

import { useState } from 'react'

// Agent on/off plus the stored timezone. The browser timezone is only sent on an explicit action
// (enabling, or "Use <timezone>"); rendering this card never writes.
export default function PreferencesCard({ preferences, onUpdate }) {
  const [saving, setSaving] = useState(false)
  const enabled = preferences.productivityAgentEnabled
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezoneDiffers = Boolean(browserTimezone) && browserTimezone !== preferences.timezone

  async function update(patch) {
    setSaving(true)
    try {
      await onUpdate(patch)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Productivity Agent</h2>
          <p className="text-sm text-foreground-muted mt-1 max-w-xl">
            {enabled
              ? 'Weekly reports review your completed week against the prior week and your weekly targets, with observations and suggestions for the next week.'
              : 'Get a weekly report that reviews your completed week against the prior week and your weekly targets, with observations and suggestions for the next week. It is off until you enable it.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="AI Productivity Agent"
          disabled={saving}
          onClick={() =>
            update(enabled ? { productivityAgentEnabled: false } : { productivityAgentEnabled: true, timezone: browserTimezone })
          }
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-blue-600' : 'bg-border-strong'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
      </div>

      {enabled && preferences.timezone && (
        <p className="text-xs text-foreground-subtle mt-3">
          Weeks run Monday–Sunday in {preferences.timezone}.
          {timezoneDiffers && (
            <>
              {' '}
              <button
                type="button"
                disabled={saving}
                onClick={() => update({ timezone: browserTimezone })}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50"
              >
                Use {browserTimezone}
              </button>
            </>
          )}
        </p>
      )}
    </section>
  )
}
