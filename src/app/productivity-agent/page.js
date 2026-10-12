'use client'

import { useCallback, useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import LoadingState from '@/components/LoadingState'
import ErrorBanner from '@/components/ErrorBanner'
import EmptyState from '@/components/EmptyState'
import PreferencesCard from '@/components/productivity-agent/PreferencesCard'
import ReportView from '@/components/productivity-agent/ReportView'
import ReportHistory from '@/components/productivity-agent/ReportHistory'
import { failureMessage, formatWeekRange } from '@/components/productivity-agent/reportFormat'

const fetchJson = (url, options) => fetch(url, options).then((r) => r.json())

const NETWORK_ERROR = 'Network error. Please try again.'

const primaryButton =
  'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50'

export default function ProductivityAgentPage() {
  const [preferences, setPreferences] = useState(null)
  const [history, setHistory] = useState({ reports: [], targetWeekStartDate: null })
  const [selectedId, setSelectedId] = useState(null)
  const [detailState, setDetailState] = useState(null) // { id, report }
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  const applyHistory = useCallback((data, preferredId) => {
    setHistory(data)
    setSelectedId((current) => preferredId ?? (data.reports.some((r) => r.id === current) ? current : (data.reports[0]?.id ?? null)))
  }, [])

  useEffect(() => {
    Promise.all([fetchJson('/api/productivity-agent/preferences'), fetchJson('/api/productivity-agent/reports')])
      .then(([prefs, reports]) => {
        if (prefs.success) setPreferences(prefs.data)
        else setError(prefs.message ?? 'Failed to load preferences')
        if (reports.success) applyHistory(reports.data)
        else setError(reports.message ?? 'Failed to load reports')
      })
      .catch(() => setError(NETWORK_ERROR))
      .finally(() => setLoading(false))
  }, [applyHistory])

  const selected = history.reports.find((r) => r.id === selectedId) ?? null
  const selectedIsCompleted = selected?.status === 'completed'
  const detail = detailState?.id === selectedId ? detailState.report : null

  useEffect(() => {
    if (!selectedId || !selectedIsCompleted) return
    let ignore = false
    fetch(`/api/productivity-agent/reports/${selectedId}`)
      .then((r) => r.json())
      .then((json) => {
        if (ignore) return
        if (json.success) setDetailState({ id: selectedId, report: json.data })
        else setError(json.message ?? 'Failed to load the report')
      })
      .catch(() => !ignore && setError(NETWORK_ERROR))
    return () => {
      ignore = true
    }
  }, [selectedId, selectedIsCompleted])

  async function updatePreferences(patch) {
    setError(null)
    try {
      const json = await fetch('/api/productivity-agent/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then((r) => r.json())
      if (json.success) {
        setPreferences(json.data)
        // The generation target week depends on the stored timezone, which this update may have set.
        const reports = await fetchJson('/api/productivity-agent/reports')
        if (reports.success) applyHistory(reports.data)
      } else setError(json.message ?? 'Failed to save the preference')
    } catch {
      setError(NETWORK_ERROR)
    }
  }

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const json = await fetchJson('/api/productivity-agent/reports', { method: 'POST' })
      if (!json.success) setError(json.message ?? 'The report could not be generated.')
      const reports = await fetchJson('/api/productivity-agent/reports')
      if (reports.success) applyHistory(reports.data, json.success ? json.data.reportId : undefined)
    } catch {
      setError(NETWORK_ERROR)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <LoadingState />
      </div>
    )
  }

  const enabled = preferences?.productivityAgentEnabled === true
  const targetReport = history.reports.find((r) => r.weekStartDate === history.targetWeekStartDate)
  const canGenerate = enabled && history.targetWeekStartDate && (!targetReport || targetReport.status === 'failed')
  const generateLabel = targetReport?.status === 'failed' ? 'Try again' : 'Generate report'

  function handleEmailSent(data) {
    setDetailState((prev) => {
      if (prev?.id === data.reportId) {
        return {
          id: prev.id,
          report: {
            ...prev.report,
            emailStatus: data.emailStatus,
            emailSentAt: data.emailSentAt,
            emailRecipient: data.recipient,
          },
        }
      }
      return prev
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 max-md:pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-6">
      <PageHeader title="AI Productivity Agent" subtitle="A weekly review of how you spent your time" />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {preferences && <PreferencesCard preferences={preferences} onUpdate={updatePreferences} />}

      {canGenerate && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={generate} disabled={generating} className={primaryButton}>
            {generating ? 'Generating…' : generateLabel}
          </button>
          <span className="text-xs text-foreground-subtle" aria-live="polite">
            {generating
              ? 'This can take up to a minute.'
              : `For the week of ${formatWeekRange(history.targetWeekStartDate)}.`}
          </span>
        </div>
      )}

      {history.reports.length === 0 ? (
        <EmptyState
          message={
            enabled
              ? 'No reports yet. Generate your first weekly report once a full week has been logged.'
              : 'No reports yet. Enable the AI Productivity Agent to generate weekly reports.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6 items-start">
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Reports</h2>
            <ReportHistory reports={history.reports} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="min-w-0">
            {selected?.status === 'failed' && (
              <p className="text-sm text-foreground-secondary">
                {failureMessage(selected.errorCode)}
                {enabled ? ' You can try again.' : ' Enable the AI Productivity Agent to try again.'}
              </p>
            )}
            {selected?.status === 'generating' && (
              <p className="text-sm text-foreground-secondary">This report is being generated.</p>
            )}
            {selectedIsCompleted && (detail ? <ReportView report={detail} onEmailSent={handleEmailSent} /> : <LoadingState />)}
          </div>
        </div>
      )}
    </div>
  )
}
