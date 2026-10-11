import Markdown from '@/components/assistant/Markdown'

// Assistant text is rendered as safe Markdown; user text stays plain. Choices are optional
// shortcuts: they send the option's message like a typed reply and never block the input.
export default function ChatMessage({ role, text, choices, onChoose, choicesDisabled }) {
  if (role === 'notice') {
    return <p className="text-center text-xs text-foreground-muted px-4">{text}</p>
  }
  const isUser = role === 'user'
  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2 text-sm rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md whitespace-pre-wrap break-words'
            : 'bg-surface-muted text-foreground rounded-bl-md'
        }`}
      >
        {isUser ? text : <Markdown text={text} />}
      </div>
      {choices?.length > 0 && (
        <div className="flex flex-col gap-1.5 w-full max-w-[85%]" role="group" aria-label="Suggested answers">
          {choices.map((choice, index) => (
            <button
              key={index}
              type="button"
              disabled={choicesDisabled}
              onClick={() => onChoose(choice.message)}
              className="text-left text-sm text-blue-700 dark:text-blue-300 bg-surface border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 active:bg-blue-100 dark:active:bg-blue-900/40 disabled:opacity-50 disabled:hover:bg-surface"
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ThinkingIndicator() {
  return (
    <div className="flex justify-start" role="status" aria-label="Assistant is thinking">
      <div className="flex items-center gap-1 bg-surface-muted rounded-2xl rounded-bl-md px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-foreground-subtle animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
