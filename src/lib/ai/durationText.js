// User-facing duration text for assistant replies. Minutes stay the authoritative internal value
// (tool results, services, database); this only changes how the final reply reads. It is separate
// from `formatMinutes` in `lib/formatters.js` (compact "2h 34m", used by the UI).

const plural = (count, unit) => `${count} ${unit}${count === 1 ? '' : 's'}`

// 45 -> "45 mins", 60 -> "1 hr", 75 -> "1 hr 15 mins", 154 -> "2 hrs 34 mins". Null for anything
// that is not a non-negative integer.
export function formatDurationText(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0) return null
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return plural(remainder, 'min')
  return remainder === 0 ? plural(hours, 'hr') : `${plural(hours, 'hr')} ${plural(remainder, 'min')}`
}

// Deliberately narrow: only a clear whole-number duration written as "<n> min|mins|minute|minutes".
// Left untouched: decimals ("1.5 minutes"), ranges and compounds ("30-45 minutes", "90-minute"),
// a minutes part that follows hours ("2 hrs 34 mins"), and code spans/blocks. Idempotent.
const DURATION = /(\d+\s*(?:h|hrs?|hours?)\s+)?(?<![\d.,-])(\d{1,3}(?:,\d{3})+|\d+)[  ](?:minutes?|mins?)(?![\w-])/gi
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/

export function humanizeDurations(text) {
  if (typeof text !== 'string') return text
  return text
    .split(CODE)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(DURATION, (match, hoursPart, digits) => {
            if (hoursPart) return match
            return formatDurationText(Number(digits.replaceAll(',', ''))) ?? match
          })
    )
    .join('')
}
