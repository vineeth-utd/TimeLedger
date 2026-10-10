'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, SquarePen, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAssistant } from '@/components/assistant/useAssistant'
import ChatMessage, { ThinkingIndicator } from '@/components/assistant/ChatMessage'
import ConfirmationCard from '@/components/assistant/ConfirmationCard'
import ChatInput from '@/components/assistant/ChatInput'
import ErrorBanner from '@/components/ErrorBanner'

const SUGGESTIONS = [
  'What did I do today?',
  'Log 1 hour of gym this morning',
  'How much time did I spend on Career this week?',
]

// Floating assistant: a right-side panel on desktop/tablet and a full-screen sheet on mobile,
// both rendering the same state. Mounted once in the root layout for authenticated pages.
export default function AssistantWidget() {
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const assistant = useAssistant()
  const { clearForSignOut } = assistant
  const inputRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => {
    let ignore = false
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!ignore) setIsAuthenticated(Boolean(session?.user))
      })
      .catch(() => {
        if (!ignore) setIsAuthenticated(false)
      })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return
      const signedIn = Boolean(session?.user)
      setIsAuthenticated(signedIn)
      if (!signedIn) {
        setOpen(false)
        setDraft('')
        clearForSignOut()
      }
    })
    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [clearForSignOut])

  const { messages, status, pendingAction, error } = assistant
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' })
  }, [open, messages, status, pendingAction])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (open && !pendingAction) inputRef.current?.focus()
  }, [open, pendingAction, status])

  if (pathname === '/login' || !isAuthenticated) return null

  const busy = status !== 'idle'
  const locked = busy || Boolean(pendingAction)

  async function submit() {
    const text = draft
    setDraft('')
    const sent = await assistant.send(text)
    if (!sent) setDraft(text)
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed z-40 bottom-4 right-4 inline-flex items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-blue-600 text-white text-sm font-medium shadow-lg hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Sparkles className="w-4 h-4" strokeWidth={2} />
          Assistant
          {pendingAction && <span className="w-2 h-2 rounded-full bg-amber-300" aria-label="Confirmation pending" />}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="TimeLedger Assistant"
          className="fixed z-40 inset-x-0 top-0 h-dvh flex flex-col bg-white md:inset-x-auto md:top-auto md:right-4 md:bottom-4 md:w-[400px] md:h-[600px] md:max-h-[calc(100dvh-2rem)] md:rounded-2xl md:border md:border-gray-200 md:shadow-xl overflow-hidden"
        >
          <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-blue-600" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 truncate">TimeLedger Assistant</h2>
              <p className="text-xs text-gray-500 truncate">Log and review your time by chatting</p>
            </div>
            <button
              type="button"
              onClick={assistant.newConversation}
              disabled={locked}
              aria-label="New conversation"
              title={pendingAction ? 'Approve or reject the pending request first' : 'New conversation'}
              className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <SquarePen className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && !pendingAction ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-2">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-blue-600" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-gray-900">How can I help?</p>
                <p className="text-sm text-gray-500 mt-1 max-w-xs">
                  Add or edit activities, look up your time and manage categories.
                </p>
                <div className="mt-4 flex flex-col gap-2 w-full max-w-xs">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setDraft(suggestion)
                        inputRef.current?.focus()
                      }}
                      className="text-left text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  // Choices are offered only on the latest message; typing a reply stays possible.
                  const offerChoices = index === messages.length - 1 && !pendingAction
                  return (
                    <ChatMessage
                      key={message.id}
                      role={message.role}
                      text={message.text}
                      choices={offerChoices ? message.choices : undefined}
                      choicesDisabled={locked}
                      onChoose={assistant.send}
                    />
                  )
                })}
                {pendingAction && (
                  <ConfirmationCard
                    pendingAction={pendingAction}
                    busy={busy}
                    onDecision={assistant.resolve}
                  />
                )}
                {status !== 'idle' && <ThinkingIndicator />}
              </>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="px-3 pb-2">
              <ErrorBanner message={error} onDismiss={assistant.dismissError} />
            </div>
          )}

          <ChatInput
            ref={inputRef}
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            disabled={locked}
            placeholder={pendingAction ? 'Approve or reject the request above' : 'Message the assistant'}
          />
        </section>
      )}
    </>
  )
}
