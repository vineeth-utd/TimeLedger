export function formatMinutes(mins) {
  if (!mins || mins === 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatTime(isoString) {
  const d = new Date(isoString)
  const utcH = d.getUTCHours()
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  const ampm = utcH >= 12 ? 'PM' : 'AM'
  const h = utcH % 12 || 12
  return `${h}:${m} ${ampm}`
}

export function getWeekStartMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().substring(0, 10)
}
