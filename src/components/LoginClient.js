'use client'

import { useState } from 'react'
import { Clock, Target, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const benefits = [
  { icon: Clock, text: 'Log your time without extra clutter.' },
  { icon: Target, text: 'Keep weekly targets in view.' },
  { icon: TrendingUp, text: 'See where your attention is going.' },
]

export default function LoginClient() {
  const [error, setError] = useState('')

  const handleGoogleLogin = async () => {
    setError('')

    const redirectTo = `${window.location.origin}/auth/callback`

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })

    if (signInError) {
      setError(signInError.message)
    }
  }

  return (
    <section
      aria-labelledby="login-heading"
      className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_48%,#f8fafc_100%)] px-4 py-10"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:34px_34px] opacity-60"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-8.5rem)] w-full max-w-md items-center">
        <div className="w-full rounded-lg border border-slate-200 bg-white/95 p-7 shadow-lg shadow-slate-200/70 ring-1 ring-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Clock className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Private time tracking</p>
              <h1 id="login-heading" className="text-2xl font-semibold text-slate-950">
                TimeLedger
              </h1>
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            Sign in with Google to access your personal time ledger.
          </p>

          <ul className="mt-6 space-y-3">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-600">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-blue-600">
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-800"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600">
              <svg viewBox="0 0 18 18" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.72H.94v2.33A9 9 0 0 0 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.95 10.7a5.41 5.41 0 0 1 0-3.4V4.97H.94a9 9 0 0 0 0 8.06l3.01-2.33z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.97L3.95 7.3C4.66 5.16 6.65 3.58 9 3.58z"
                />
              </svg>
            </span>
            Continue with Google
          </button>

          {error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
