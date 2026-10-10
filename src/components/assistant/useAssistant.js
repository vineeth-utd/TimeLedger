'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { describeDecision, newThreadId, notifyDataChanged, planResult, sendChat, sendConfirm } from '@/lib/assistantClient'

const STORAGE_KEY = 'timeledger.assistant.v1'

function loadStored() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (stored && Array.isArray(stored.messages)) return stored
  } catch {}
  return null
}

function saveStored(value) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {}
}

const makeMessage = (role, text, choices) => ({
  id: crypto.randomUUID(),
  role,
  text,
  ...(choices && { choices }),
})

// Shared assistant state for every presentation (desktop panel and mobile sheet).
// Persists only threadId, displayed messages and pendingAction (sessionStorage).
export function useAssistant() {
  const router = useRouter()
  // Lazy init from sessionStorage (null on the server). The widget renders nothing until the
  // session is confirmed on the client, so this cannot cause a hydration mismatch.
  const [threadId, setThreadId] = useState(() => loadStored()?.threadId ?? null)
  const [messages, setMessages] = useState(() => loadStored()?.messages ?? [])
  const [pendingAction, setPendingAction] = useState(() => loadStored()?.pendingAction ?? null)
  const [status, setStatus] = useState('idle') // 'idle' | 'sending' | 'resolving'
  const [error, setError] = useState(null)
  const busyRef = useRef(false)

  useEffect(() => {
    saveStored(messages.length || pendingAction ? { threadId, messages, pendingAction } : null)
  }, [threadId, messages, pendingAction])

  const addMessage = useCallback((role, text, choices) => {
    setMessages((current) => [...current, makeMessage(role, text, choices)])
  }, [])

  const reset = useCallback(() => {
    setThreadId(null)
    setMessages([])
    setPendingAction(null)
    setError(null)
    setStatus('idle')
  }, [])

  // Sign-out ends the conversation so the next user in this tab never sees it.
  const clearForSignOut = useCallback(() => {
    reset()
    saveStored(null)
  }, [reset])

  // All decisions come from planResult (server-provided changes/outcome/code), never prose.
  const applyResult = useCallback(
    (result, kind) => {
      const plan = planResult(result, kind)
      if (plan.unauthorized) {
        router.replace('/login')
        return
      }
      if (plan.refresh) notifyDataChanged()
      if (plan.pending !== 'keep') setPendingAction(plan.pending === 'clear' ? null : plan.pending)
      for (const message of plan.messages) addMessage(message.role, message.text, message.choices)
      if (plan.error) setError(plan.error)
      if (plan.resetThread) setThreadId(null)
    },
    [router, addMessage]
  )

  const send = useCallback(
    async (text) => {
      const message = text.trim()
      if (!message || busyRef.current || pendingAction) return false
      busyRef.current = true
      const id = threadId ?? newThreadId()
      setThreadId(id)
      addMessage('user', message)
      setError(null)
      setStatus('sending')
      try {
        applyResult(await sendChat(id, message), 'chat')
      } finally {
        busyRef.current = false
        setStatus('idle')
      }
      return true
    },
    [threadId, pendingAction, addMessage, applyResult]
  )

  // decision: 'approve' | 'reject'. Never retried automatically.
  const resolve = useCallback(
    async (decision) => {
      if (!pendingAction || !threadId || busyRef.current) return
      busyRef.current = true
      setError(null)
      setStatus('resolving')
      try {
        const result = await sendConfirm(threadId, pendingAction.actionId, decision)
        // Keep a record of what was decided, but only when the server actually resolved it.
        if (result.ok || result.outcome === 'applied' || result.outcome === 'none') {
          for (const record of describeDecision(pendingAction, decision)) addMessage(record.role, record.text)
        }
        applyResult(result, 'confirm')
      } finally {
        busyRef.current = false
        setStatus('idle')
      }
    },
    [pendingAction, threadId, addMessage, applyResult]
  )

  return {
    messages,
    pendingAction,
    status,
    error,
    dismissError: () => setError(null),
    send,
    resolve,
    newConversation: () => {
      if (!pendingAction && !busyRef.current) reset()
    },
    clearForSignOut,
  }
}
