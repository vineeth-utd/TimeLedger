import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { createToolContext } from '@/lib/ai/context'
import { resumeAssistant } from '@/lib/ai/assistant'
import { DECISIONS } from '@/lib/ai/confirmation'
import { assistantErrorResponse, turnResponse } from '@/lib/ai/http'
import { isValidTimeZone } from '@/lib/timezone'

export const maxDuration = 60

// The client identifies the pending action and decides; it never supplies tool arguments.
const bodySchema = z.strictObject({
  threadId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/, 'threadId must be 1-100 letters, digits, "-" or "_"'),
  actionId: z.string().regex(/^act_[0-9a-f]{24}$/, 'actionId is invalid'),
  decision: z.enum(DECISIONS),
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
    const { threadId, actionId, decision, timezone } = parsed.data

    const ctx = createToolContext({ userId: user.id, timezone, now: new Date() })
    const result = await resumeAssistant({ ctx, threadId, actionId, decision })

    return turnResponse(threadId, result)
  } catch (error) {
    return assistantErrorResponse(error, 'POST /api/assistant/confirm')
  }
}
