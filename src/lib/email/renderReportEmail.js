import { formatMinutes } from '@/lib/formatters'
import {
  TARGET_STATUS_LABELS,
  formatSigned,
  formatWeekRange,
} from '@/components/productivity-agent/reportFormat'

function escapeHtml(str) {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderReportEmail({ report }) {
  const { weekStartDate, facts: rawFacts, content } = report
  const facts = rawFacts?.facts ?? rawFacts ?? {}
  const weekRange = formatWeekRange(weekStartDate)
  const subject = `Weekly Productivity Report — Week of ${weekRange}`

  if (!content) {
    throw new Error('Report content is required to render email')
  }

  const isInsufficient = content.kind === 'insufficient_data'

  // Text version
  let text = `TimeLedger — Weekly Productivity Report\n`
  text += `Week of ${weekRange}\n`
  text += `${'='.repeat(45)}\n\n`
  text += `${content.overview}\n\n`

  if (!isInsufficient && facts.totals) {
    const { totals, mainCategories = [] } = facts
    const hasPrior = totals.prior?.minutes > 0

    text += `SUMMARY\n`
    text += `- Total Time: ${formatMinutes(totals.report.minutes)}`
    if (hasPrior) {
      text += ` (${formatSigned(formatMinutes, totals.change.minutes)} vs prior week)`
    }
    text += `\n- Activities: ${totals.report.activities}\n`
    text += `- Active Days: ${totals.report.activeDays}/7\n\n`

    const targetRows = mainCategories.filter((m) => m.target?.report)
    if (targetRows.length > 0) {
      text += `TARGET VS ACTUAL\n`
      for (const m of targetRows) {
        const label = TARGET_STATUS_LABELS[m.target.report.status] ?? ''
        text += `- ${m.name}: ${formatMinutes(m.target.report.actualMinutes)} / ${formatMinutes(m.target.report.targetMinutes)} (${m.target.report.achievementPercent}%) - ${label}\n`
      }
      text += `\n`
    }

    if (content.mainCategoryInsights?.length > 0) {
      text += `MAIN CATEGORY INSIGHTS\n`
      for (const i of content.mainCategoryInsights) {
        text += `- ${i.headline}: ${i.observed}\n`
        if (i.possibleExplanation) text += `  (Explanation: ${i.possibleExplanation})\n`
      }
      text += `\n`
    }

    if (content.recommendations?.length > 0) {
      text += `RECOMMENDATIONS FOR NEXT WEEK\n`
      for (const r of content.recommendations) {
        text += `- ${r.title}: ${r.action}\n  Rationale: ${r.rationale}\n`
      }
      text += `\n`
    }
  }

  // HTML version
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; padding: 24px;">
    <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 20px;">
      <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 700; color: #111827;">Weekly Productivity Report</h1>
      <p style="margin: 0; font-size: 14px; color: #6b7280;">Week of ${escapeHtml(weekRange)}</p>
    </div>

    <p style="font-size: 15px; line-height: 1.5; color: #374151; margin-bottom: 24px;">
      ${escapeHtml(content.overview)}
    </p>`

  if (!isInsufficient && facts.totals) {
    const { totals, mainCategories = [] } = facts
    const hasPrior = totals.prior?.minutes > 0

    html += `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 33%; text-align: center; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Time</div>
            <div style="font-size: 18px; font-weight: 700; color: #111827; margin-top: 4px;">${escapeHtml(formatMinutes(totals.report.minutes))}</div>
            ${hasPrior ? `<div style="font-size: 11px; color: ${totals.change.minutes >= 0 ? '#059669' : '#dc2626'}; margin-top: 2px;">${escapeHtml(formatSigned(formatMinutes, totals.change.minutes))}</div>` : ''}
          </td>
          <td style="width: 33%; text-align: center; border-right: 1px solid #e5e7eb;">
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Activities</div>
            <div style="font-size: 18px; font-weight: 700; color: #111827; margin-top: 4px;">${totals.report.activities}</div>
          </td>
          <td style="width: 33%; text-align: center;">
            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Active Days</div>
            <div style="font-size: 18px; font-weight: 700; color: #111827; margin-top: 4px;">${totals.report.activeDays}/7</div>
          </td>
        </tr>
      </table>
    </div>`

    const targetRows = mainCategories.filter((m) => m.target?.report)
    if (targetRows.length > 0) {
      html += `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Target vs Actual</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="border-bottom: 1px solid #e5e7eb; color: #6b7280; text-align: left;">
            <th style="padding: 6px 0;">Category</th>
            <th style="padding: 6px 0;">Target</th>
            <th style="padding: 6px 0;">Actual</th>
            <th style="padding: 6px 0; text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>`
      for (const m of targetRows) {
        html += `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 8px 0; font-weight: 500;">${escapeHtml(m.name)}</td>
            <td style="padding: 8px 0; color: #6b7280;">${escapeHtml(formatMinutes(m.target.report.targetMinutes))}</td>
            <td style="padding: 8px 0;">${escapeHtml(formatMinutes(m.target.report.actualMinutes))} (${m.target.report.achievementPercent}%)</td>
            <td style="padding: 8px 0; text-align: right; color: #4b5563;">${escapeHtml(TARGET_STATUS_LABELS[m.target.report.status] ?? '')}</td>
          </tr>`
      }
      html += `
        </tbody>
      </table>
    </div>`
    }

    if (content.mainCategoryInsights?.length > 0) {
      html += `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Insights</h2>`
      for (const i of content.mainCategoryInsights) {
        html += `
      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f3f4f6;">
        <div style="font-weight: 600; font-size: 14px; color: #111827;">${escapeHtml(i.headline)}</div>
        <div style="font-size: 13px; color: #4b5563; margin-top: 4px;">${escapeHtml(i.observed)}</div>
        ${i.possibleExplanation ? `<div style="font-size: 12px; font-style: italic; color: #6b7280; margin-top: 4px;">Possible explanation: ${escapeHtml(i.possibleExplanation)}</div>` : ''}
      </div>`
      }
      html += `</div>`
    }

    if (content.recommendations?.length > 0) {
      html += `
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Recommendations for Next Week</h2>`
      for (const r of content.recommendations) {
        html += `
      <div style="background-color: #f9fafb; border-left: 3px solid #3b82f6; padding: 10px 14px; margin-bottom: 8px; border-radius: 0 4px 4px 0;">
        <div style="font-weight: 600; font-size: 14px; color: #111827;">${escapeHtml(r.title)}</div>
        <div style="font-size: 13px; color: #374151; margin-top: 4px;">${escapeHtml(r.action)}</div>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${escapeHtml(r.rationale)}</div>
      </div>`
      }
      html += `</div>`
    }
  }

  html += `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
      This email was generated by your TimeLedger AI Productivity Agent.
    </div>
  </div>
</body>
</html>`

  return { subject, html, text }
}
