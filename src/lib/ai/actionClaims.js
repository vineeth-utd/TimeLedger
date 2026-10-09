import prisma from '@/lib/prisma'
import { isUniqueViolation } from '@/lib/errors'

// Durable at-most-once resolution of a pending action. Exactly one request can insert the row for
// (user, thread, action); every later resolution attempt (approve or reject, concurrent or not,
// on any server instance) loses and must not run the action. Claims are never released: if the
// first run fails midway the outcome is unknown and the action is not executed again.
export async function claimAction({ userId, threadId, actionId, decision }) {
  try {
    await prisma.assistantActionClaim.create({ data: { userId, threadId, actionId, decision } })
    return true
  } catch (error) {
    if (isUniqueViolation(error)) return false
    throw error
  }
}
