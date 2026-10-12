import { useState } from 'react'
import { Activity, AlertCircle, Calendar, CheckCircle2, Clock, Mail } from 'lucide-react'
import SummaryCard from '@/components/SummaryCard'
import { formatDateOnly, formatMinutes } from '@/lib/formatters'
import { TARGET_STATUS_LABELS, formatSigned, formatWeekRange } from '@/components/productivity-agent/reportFormat'

const SUPPORTED_SCHEMA_VERSION = 1

function Section({ title, subtitle, children }) {
  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-foreground-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

const Explanation = ({ text }) =>
  text ? (
    <p className="text-sm text-foreground-muted mt-1.5 italic">
      <span className="not-italic font-medium">Possible explanation: </span>
      {text}
    </p>
  ) : null

function Insight({ title, subtitle, observed, targetCommentary, possibleExplanation }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-xs text-foreground-subtle">{subtitle}</p>}
      <p className="text-sm text-foreground-secondary mt-1">{observed}</p>
      {targetCommentary && <p className="text-sm text-foreground-secondary mt-1">{targetCommentary}</p>}
      <Explanation text={possibleExplanation} />
    </li>
  )
}

function ChangeCell({ minutes }) {
  const cls = minutes > 0 ? 'text-emerald-600 dark:text-emerald-400' : minutes < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground-muted'
  return <span className={cls}>{formatSigned(formatMinutes, minutes)}</span>
}

// Renders a persisted completed report: deterministic numbers from `facts`, AI text from `content`.
// Names always come from `facts` (looked up by id), never from the model's text.
export default function ReportView({ report, onEmailSent }) {
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [emailSuccess, setEmailSuccess] = useState(null)

  const facts = report.facts?.facts
  const content = report.content
  if (!facts?.totals || !Array.isArray(facts.mainCategories) || !content || content.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return <p className="text-sm text-foreground-muted">This report can’t be displayed.</p>
  }

  const { totals, mainCategories } = facts
  const mainById = new Map(mainCategories.map((m) => [m.mainCategoryId, m]))
  const subById = new Map(mainCategories.flatMap((m) => m.subCategories.map((s) => [s.subCategoryId, { ...s, mainName: m.name }])))
  const targetRows = mainCategories.filter((m) => m.target?.report)
  const comparisonRows = mainCategories.filter((m) => m.report.minutes > 0 || m.prior.minutes > 0)
  const hasPrior = totals.prior.minutes > 0
  const referenceName = (mainId, subId) => subById.get(subId)?.name ?? mainById.get(mainId)?.name ?? null

  async function handleSendEmail() {
    setSendingEmail(true)
    setEmailError(null)
    setEmailSuccess(null)
    try {
      const res = await fetch(`/api/productivity-agent/reports/${report.id}/email`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setEmailSuccess(`Email sent to ${json.data.recipient}`)
        if (onEmailSent) onEmailSent(json.data)
      } else {
        setEmailError(json.message ?? 'Failed to send email.')
      }
    } catch {
      setEmailError('Network error sending email.')
    } finally {
      setSendingEmail(false)
    }
  }

  const emailStatus = report.emailStatus
  const isSent = emailStatus === 'sent'
  const isFailed = emailStatus === 'failed'
  const emailButtonLabel = isSent ? 'Resend email' : isFailed ? 'Retry email' : 'Send to email'

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Week of {formatWeekRange(report.weekStartDate)}</h2>
          <p className="text-xs text-foreground-subtle mt-0.5">
            Time figures are calculated by TimeLedger; the written interpretation is AI-generated.
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          <button
            type="button"
            disabled={sendingEmail}
            onClick={handleSendEmail}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground hover:bg-surface-muted transition-colors disabled:opacity-50"
          >
            <Mail className="h-3.5 w-3.5" />
            {sendingEmail ? 'Sending…' : emailButtonLabel}
          </button>
          {isSent && report.emailRecipient && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Sent to {report.emailRecipient}
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-3 w-3" />
              Delivery failed
            </span>
          )}
          {emailSuccess && !isSent && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">{emailSuccess}</span>
          )}
          {emailError && (
            <span className="text-[11px] text-rose-600 dark:text-rose-400">{emailError}</span>
          )}
        </div>
      </div>

      <p className="text-sm text-foreground-secondary">{content.overview}</p>

      {content.kind === 'ai_report' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label="Total Time"
              value={formatMinutes(totals.report.minutes)}
              icon={Clock}
              sublabel={hasPrior ? `${formatSigned(formatMinutes, totals.change.minutes)} vs prior week` : undefined}
            />
            <SummaryCard label="Activities" value={totals.report.activities} icon={Activity} />
            <SummaryCard label="Active Days" value={totals.report.activeDays} icon={Calendar} />
          </div>

          {content.dataNotes.length > 0 && (
            <div className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 space-y-1">
              {content.dataNotes.map((note, i) => (
                <p key={i}>{note}</p>
              ))}
            </div>
          )}

          {targetRows.length > 0 && (
            <Section title="Target vs Actual" subtitle="Weekly targets you set">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-foreground-muted uppercase tracking-wide">
                      <th scope="col" className="px-1 py-2 font-medium">Category</th>
                      <th scope="col" className="px-1 py-2 font-medium">Target</th>
                      <th scope="col" className="px-1 py-2 font-medium">Actual</th>
                      <th scope="col" className="px-1 py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targetRows.map((m) => (
                      <tr key={m.mainCategoryId} className="border-t border-border-subtle">
                        <td className="px-1 py-2.5 text-foreground font-medium">{m.name}</td>
                        <td className="px-1 py-2.5 text-foreground-muted">{formatMinutes(m.target.report.targetMinutes)}</td>
                        <td className="px-1 py-2.5 text-foreground">
                          {formatMinutes(m.target.report.actualMinutes)} ({m.target.report.achievementPercent}%)
                        </td>
                        <td className="px-1 py-2.5 text-right text-xs text-foreground-secondary">
                          {TARGET_STATUS_LABELS[m.target.report.status] ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {hasPrior && comparisonRows.length > 0 && (
            <Section title="Week over Week" subtitle="Main categories compared with the prior week">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-foreground-muted uppercase tracking-wide">
                      <th scope="col" className="px-1 py-2 font-medium">Category</th>
                      <th scope="col" className="px-1 py-2 font-medium">This week</th>
                      <th scope="col" className="px-1 py-2 font-medium">Prior</th>
                      <th scope="col" className="px-1 py-2 font-medium text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((m) => (
                      <tr key={m.mainCategoryId} className="border-t border-border-subtle">
                        <td className="px-1 py-2.5 text-foreground font-medium">{m.name}</td>
                        <td className="px-1 py-2.5 text-foreground">{formatMinutes(m.report.minutes)}</td>
                        <td className="px-1 py-2.5 text-foreground-muted">{formatMinutes(m.prior.minutes)}</td>
                        <td className="px-1 py-2.5 text-right"><ChangeCell minutes={m.change.minutes} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {content.mainCategoryInsights.length > 0 && (
            <Section title="Main Category Insights">
              <ul className="divide-y divide-border-subtle">
                {content.mainCategoryInsights.map((i) => (
                  <Insight
                    key={i.mainCategoryId}
                    title={mainById.get(i.mainCategoryId)?.name ?? i.headline}
                    subtitle={mainById.has(i.mainCategoryId) ? i.headline : null}
                    observed={i.observed}
                    targetCommentary={i.targetCommentary}
                    possibleExplanation={i.possibleExplanation}
                  />
                ))}
              </ul>
            </Section>
          )}

          {content.subCategoryInsights.length > 0 && (
            <Section title="Sub Category Insights">
              <ul className="divide-y divide-border-subtle">
                {content.subCategoryInsights.map((i) => {
                  const sub = subById.get(i.subCategoryId)
                  return (
                    <Insight
                      key={i.subCategoryId}
                      title={sub?.name ?? i.headline}
                      subtitle={sub ? `${sub.mainName} · ${i.headline}` : null}
                      observed={i.observed}
                      possibleExplanation={i.possibleExplanation}
                    />
                  )
                })}
              </ul>
            </Section>
          )}

          {content.observations.length > 0 && (
            <Section title="Observations">
              <ul className="divide-y divide-border-subtle">
                {content.observations.map((o, i) => (
                  <li key={i} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm text-foreground-secondary">{o.observed}</p>
                    <Explanation text={o.possibleExplanation} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {content.recommendations.length > 0 && (
            <Section title="Recommendations for Next Week">
              <ul className="divide-y divide-border-subtle">
                {content.recommendations.map((r, i) => {
                  const ref = referenceName(r.mainCategoryId, r.subCategoryId)
                  return (
                    <li key={i} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      {ref && <p className="text-xs text-foreground-subtle">{ref}</p>}
                      <p className="text-sm text-foreground-secondary mt-1">{r.action}</p>
                      <p className="text-sm text-foreground-muted mt-1">{r.rationale}</p>
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
