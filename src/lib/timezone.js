// Timezone-aware conversion between a local calendar date + "HH:mm" and a UTC instant.
// "24:00" is accepted as the end-of-day boundary: it means 00:00 on the NEXT calendar date.
// Intervals are half-open, so a cross-midnight activity can be split into
// [D start–24:00] and [D+1 00:00–end] with no gap and no double-counted minute.

const formatterCache = new Map()

function getFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    )
  }
  return formatterCache.get(timeZone)
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return false
  try {
    getFormatter(timeZone)
    return true
  } catch {
    return false
  }
}

function getLocalParts(date, timeZone) {
  const parts = {}
  for (const { type, value } of getFormatter(timeZone).formatToParts(date)) {
    if (type !== 'literal') parts[type] = Number(value)
  }
  return parts
}

// Offset (ms) of `timeZone` from UTC at the given instant.
function getOffsetMs(date, timeZone) {
  const p = getLocalParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

export function addDaysToDateString(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// ("2026-10-07", "17:30", tz) -> Date (UTC instant)
export function localDateTimeToUtc(dateString, timeString, timeZone) {
  let date = dateString
  let [hours, minutes] = timeString.split(':').map(Number)
  if (hours === 24) {
    date = addDaysToDateString(dateString, 1)
    hours = 0
  }
  const [y, m, d] = date.split('-').map(Number)
  const wallClockAsUtc = Date.UTC(y, m - 1, d, hours, minutes)
  // Two passes so the offset is correct across a DST transition.
  let utc = wallClockAsUtc - getOffsetMs(new Date(wallClockAsUtc), timeZone)
  utc = wallClockAsUtc - getOffsetMs(new Date(utc), timeZone)
  return new Date(utc)
}

// UTC instant -> { date: "YYYY-MM-DD", time: "HH:mm" } in `timeZone`
export function utcToLocalDateTime(instant, timeZone) {
  const p = getLocalParts(new Date(instant), timeZone)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  }
}

// "YYYY-MM-DD" from a @db.Date value (stored as UTC midnight)
export function dateOnlyToString(date) {
  return new Date(date).toISOString().slice(0, 10)
}
