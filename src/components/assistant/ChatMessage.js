import Markdown from '@/components/assistant/Markdown'

// Assistant text is rendered as safe Markdown; user text stays plain. Choices are optional
// shortcuts: they send the option's message like a typed reply and never block the input.
export default function ChatMessage({ role, text, choices, onChoose, choicesDisabled }) {
  if (role === 'notice') {
    return <p className="text-center text-xs text-gray-500 px-4">{text}</p>
  }
  const isUser = role === 'user'
  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2 text-sm rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md whitespace-pre-wrap break-words'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
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
              className="text-left text-sm text-blue-700 bg-white border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50 disabled:hover:bg-white"
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
      <div className="flex items-center gap-1 bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
