import { formatDateOnly } from '@/lib/formatters'

export const formatWeekRange = (weekStartDate) => {
  const dateStr = weekStartDate instanceof Date
    ? weekStartDate.toISOString().slice(0, 10)
    : typeof weekStartDate === 'string' && weekStartDate.includes('T')
      ? weekStartDate.slice(0, 10)
      : String(weekStartDate)
  const start = new Date(`${dateStr}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const iso = (d) => d.toISOString().slice(0, 10)
  const fmt = (d, extra) => formatDateOnly(iso(d), { month: 'short', day: 'numeric', ...extra })
  return `${fmt(start)} – ${fmt(end, { year: 'numeric' })}`
}

export const FAILURE_MESSAGES = {
  LLM_RATE_LIMITED: 'The AI provider was busy.',
  LLM_UNAVAILABLE: 'The AI provider was unavailable.',
  REPORT_TRUNCATED: 'The generated report was incomplete.',
}
export const failureMessage = (errorCode) => FAILURE_MESSAGES[errorCode] ?? 'The report could not be generated.'

export const TARGET_STATUS_LABELS = {
  exceeded: 'Above target',
  achieved: 'Target met',
  near_target: 'Near target',
  below_target: 'Below target',
}

// Signed minutes for change columns, e.g. "+1h 30m" / "-45m" / "0m".
export const formatSigned = (formatMinutes, minutes) =>
  minutes > 0 ? `+${formatMinutes(minutes)}` : minutes < 0 ? `-${formatMinutes(Math.abs(minutes))}` : formatMinutes(0)
