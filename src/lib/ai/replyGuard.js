// Detects one specific model failure: a final reply containing a long run of blank/invisible
// spacing characters (observed: ~44 spaces/zero-width spaces, then filler and a self-correction).
// It only detects; text is never stripped or normalized, so legitimate multilingual text is safe.
//
// Counted: Unicode space separators (incl. NBSP and narrow NBSP), zero-width space, word joiner,
// BOM/ZWNBSP, soft hyphen, Mongolian vowel separator, braille blank. NOT counted: ZWJ/ZWNJ,
// variation selectors and combining marks (needed by Indic scripts and emoji), tabs, newlines.
// The threshold is conservative: real text has isolated or short occurrences, never 16 in a row.
export const MAX_BLANK_RUN = 16

const BLANK_RUN = new RegExp(`[\\p{Zs}\\u200B\\u2060\\uFEFF\\u00AD\\u180E\\u2800]{${MAX_BLANK_RUN},}`, 'u')
const CODE = /```[\s\S]*?```|`[^`\n]*`/g // code may legitimately contain long space runs
const LINE_INDENT = /^[ \t]+/ // Markdown indentation

export function hasDegenerateWhitespaceRun(text) {
  if (typeof text !== 'string') return false
  return text
    .replace(CODE, '')
    .split(/\r\n|[\n\r\u2028\u2029]/)
    .some((line) => BLANK_RUN.test(line.replace(LINE_INDENT, '')))
}

// Text of a model message's content (a string, or text blocks).
export function contentText(content) {
  if (typeof content === 'string') return content
  return (content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
