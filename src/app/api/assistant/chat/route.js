import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { createToolContext } from '@/lib/ai/context'
import { runAssistant } from '@/lib/ai/assistant'
import { assistantErrorResponse, turnResponse } from '@/lib/ai/http'
import { isValidTimeZone } from '@/lib/timezone'

export const maxDuration = 60

const bodySchema = z.strictObject({
  threadId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, 'threadId must be 1-100 letters, digits, "-" or "_"'),
  message: z.string().trim().min(1, 'message is required').max(4000, 'message is too long'),
  timezone: z.string().refine(isValidTimeZone, 'timezone must be a valid IANA timezone'),
})

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { success: false, message: parsed.error.issues.map((issue) => issue.message).join('; ') },
        { status: 400 }
      )
    }
    const { threadId, message, timezone } = parsed.data

    // Trusted context: authenticated user + browser timezone + server clock.
    const ctx = createToolContext({ userId: user.id, timezone, now: new Date() })
    const result = await runAssistant({ ctx, threadId, message })

    return turnResponse(threadId, result, 'POST /api/assistant/chat')
  } catch (error) {
    return assistantErrorResponse(error, 'POST /api/assistant/chat')
  }
}
