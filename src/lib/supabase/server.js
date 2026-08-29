import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { fetchWithTimeout } from '@/lib/supabase/fetchWithTimeout'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll was called from a Server Component; safe to ignore
            // because proxy.js already refreshes the session on every
            // navigation.
          }
        },
      },
    }
  )
}
