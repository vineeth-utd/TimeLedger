// Minimal safe Markdown for assistant replies: bold, italic, inline code, bullet/numbered lists,
// paragraphs and line breaks. Output is built only from React elements and text (never raw HTML),
// and links/images/HTML are left as plain text.

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|\*[^*\s][^*\n]*?\*)/g

function renderInline(text, keyPrefix) {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key} className="font-semibold">{renderInline(part.slice(2, -2), key)}</strong>
    }
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-black/5 px-1 py-0.5 text-[0.85em] font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^\s{0,3}#{1,6}\s+(.*)$/

// Groups lines into blocks: { type: 'ul' | 'ol' | 'p', lines }.
function parseBlocks(text) {
  const blocks = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    const type = bullet ? 'ul' : numbered ? 'ol' : line.trim() ? 'p' : null
    if (!type) {
      blocks.push(null) // blank line ends the current block
      continue
    }
    const content = bullet ? bullet[1] : numbered ? numbered[1] : line
    const last = blocks[blocks.length - 1]
    if (last && last.type === type) last.lines.push(content)
    else blocks.push({ type, lines: [content] })
  }
  return blocks.filter(Boolean)
}

export default function Markdown({ text }) {
  return (
    <div className="space-y-2 break-words">
      {parseBlocks(text).map((block, index) => {
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type === 'ul' ? 'ul' : 'ol'
          return (
            <List
              key={index}
              className={`pl-5 space-y-0.5 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}
            >
              {block.lines.map((line, i) => (
                <li key={i}>{renderInline(line, `${index}-${i}`)}</li>
              ))}
            </List>
          )
        }
        return (
          <p key={index}>
            {block.lines.map((line, i) => {
              const heading = HEADING.exec(line)
              return (
                <span key={i}>
                  {i > 0 && <br />}
                  {heading ? (
                    <strong className="font-semibold">{renderInline(heading[1], `${index}-${i}`)}</strong>
                  ) : (
                    renderInline(line, `${index}-${i}`)
                  )}
                </span>
              )
            })}
          </p>
        )
      })}
    </div>
  )
}
