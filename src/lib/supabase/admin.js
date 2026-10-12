import { createClient } from '@supabase/supabase-js'
import { EMAIL_ERROR, EmailDeliveryError } from '@/lib/email/emailErrors'

let cachedAdminClient = null

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new EmailDeliveryError(
      EMAIL_ERROR.CONFIG_MISSING,
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for background user lookup'
    )
  }

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return cachedAdminClient
}

export async function getUserEmailById(userId, { adminClient } = {}) {
  if (!userId || typeof userId !== 'string') {
    return null
  }

  const client = adminClient ?? getSupabaseAdminClient()
  const { data, error } = await client.auth.admin.getUserById(userId)

  if (error) {
    if (error.status === 401 || error.status === 403) {
      throw new EmailDeliveryError(EMAIL_ERROR.CONFIG_MISSING, 'Supabase admin auth failed')
    }
    return null
  }

  if (!data?.user) {
    return null
  }

  return data.user.email ?? null
}

