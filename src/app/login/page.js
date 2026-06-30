'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
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
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">TimeLedger</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Sign in to access your private time tracker.
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Continue with Google
        </button>

        {error ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </main>
  )
}