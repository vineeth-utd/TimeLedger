'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { newThreadId, notifyDataChanged, sendChat, sendConfirm } from '@/lib/assistantClient'

const STORAGE_KEY = 'timeledger.assistant.v1'

const NOTICES = {
  EXPIRED: 'That request expired and was cancelled. Nothing was changed.',
  NOT_PENDING: 'That request is no longer pending. Nothing was changed by it.',
  OUTCOME_UNKNOWN:
    'That request was already submitted and its result cannot be confirmed. Check your Activities, then ask again if needed.',
}

// Chat failures can happen after an activity was already created or updated, so they are never
// retried automatically and the user is told to check before trying again.
const CHAT_FAILURE =
  'The assistant could not finish that request. It may have been partly applied, so check your Activities before trying again.'
const CONFIRM_FAILURE = 'The confirmation could not be completed. Please try again.'

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

  const applyResult = useCallback(
    (result, kind) => {
      if (result.unauthorized) {
        router.replace('/login')
        return
      }
      if (result.ok) {
        // The server reports applied changes from tool results; pages then re-fetch their data.
        if (result.changes?.length) notifyDataChanged()
        if (result.pendingAction) setPendingAction(result.pendingAction)
        else {
          setPendingAction(null)
          if (result.reply) addMessage('assistant', result.reply, result.choices)
        }
        return
      }
      switch (result.code) {
        case 'PENDING_ACTION':
          setPendingAction(result.pendingAction)
          return
        case 'ACTION_EXPIRED':
          setPendingAction(null)
          addMessage('notice', NOTICES.EXPIRED)
          return
        case 'STALE_ACTION':
        case 'NO_PENDING_ACTION':
          setPendingAction(null)
          addMessage('notice', NOTICES.NOT_PENDING)
          return
        case 'ACTION_OUTCOME_UNKNOWN':
          setPendingAction(null)
          addMessage('notice', NOTICES.OUTCOME_UNKNOWN)
          return
        case 'RATE_LIMITED':
          if (kind === 'chat') notifyDataChanged() // a step may have been applied before the failure
          setError(result.message ?? 'The assistant is busy right now. Please try again in a moment.')
          return
        case 'BAD_REQUEST':
          setError(result.message ?? 'That message could not be sent.')
          return
        default:
          if (kind === 'chat') notifyDataChanged()
          setError(kind === 'chat' ? CHAT_FAILURE : CONFIRM_FAILURE)
      }
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
        if (result.ok) {
          addMessage('notice', decision === 'approve' ? 'Approved' : 'Rejected')
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
