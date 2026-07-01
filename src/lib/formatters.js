export function formatMinutes(mins) {
  if (!mins || mins === 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/

function pad2(value) {
  return String(value).padStart(2, '0')
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function getLocalDateParts(value = new Date()) {
  if (typeof value === 'string') {
    const match = value.match(DATE_ONLY_RE)
    if (match) {
      return {
        year: Number(match[1]),
        monthIndex: Number(match[2]) - 1,
        day: Number(match[3]),
      }
    }
  }

  const date = value instanceof Date ? value : new Date(value)
  if (!isValidDate(date)) return null

  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
    day: date.getDate(),
  }
}

export function formatLocalDate(date = new Date()) {
  if (!isValidDate(date)) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function toDateOnly(value = new Date()) {
  const parts = getLocalDateParts(value)
  if (!parts) return ''
  return `${parts.year}-${pad2(parts.monthIndex + 1)}-${pad2(parts.day)}`
}

export function getLocalToday() {
  return formatLocalDate(new Date())
}

export function parseLocalDate(value = new Date()) {
  const parts = getLocalDateParts(value)
  if (!parts) return null
  return new Date(parts.year, parts.monthIndex, parts.day)
}

export function addDays(dateValue, days) {
  const date = parseLocalDate(dateValue)
  if (!date) return ''
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

export function differenceInCalendarDays(endDateValue, startDateValue) {
  const endDate = parseLocalDate(endDateValue)
  const startDate = parseLocalDate(startDateValue)
  if (!endDate || !startDate) return NaN

  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  return Math.round((endUtc - startUtc) / 86400000)
}

export function getLocalMonthRange(dateValue = new Date()) {
  const date = parseLocalDate(dateValue)
  if (!date) return { startDate: '', endDate: '' }

  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    startDate: formatLocalDate(first),
    endDate: formatLocalDate(last),
  }
}

export function formatDateOnly(value, options) {
  const date = parseLocalDate(value)
  if (!date) return ''
  return date.toLocaleDateString('en-US', options)
}

export function formatTimeForInput(isoString) {
  const date = new Date(isoString)
  if (!isValidDate(date)) return ''
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function combineLocalDateAndTimeToISOString(dateValue, timeValue) {
  const date = parseLocalDate(dateValue)
  if (!date || !timeValue) return ''

  const [hours, minutes] = timeValue.split(':').map(Number)
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return date.toISOString()
}

export function formatTime(isoString) {
  const d = new Date(isoString)
  if (!isValidDate(d)) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function getWeekStartMonday(date = new Date()) {
  const d = parseLocalDate(date)
  if (!d) return ''
  const day = d.getDay() // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return formatLocalDate(d)
}
