import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getAuthenticatedUser() {
  const t0 = performance.now() // [PERF-TMP]
  const supabase = await createSupabaseServerClient()
  const t1 = performance.now() // [PERF-TMP]
  const { data: { user } } = await supabase.auth.getUser()
  const t2 = performance.now() // [PERF-TMP]
  console.log( // [PERF-TMP]
    `[PERF-TMP] createSupabaseServerClient: ${(t1 - t0).toFixed(1)}ms | ` +
    `supabase.auth.getUser(): ${(t2 - t1).toFixed(1)}ms | ` +
    `getAuthenticatedUser total: ${(t2 - t0).toFixed(1)}ms`
  )
  return user ?? null
}
