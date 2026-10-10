import prisma from '@/lib/prisma'
import { isUniqueViolation } from '@/lib/errors'

// True when this action was already claimed (resolved, running, or failed midway).
export async function isActionClaimed({ userId, threadId, actionId }) {
  const claim = await prisma.assistantActionClaim.findUnique({
    where: { userId_threadId_actionId: { userId, threadId, actionId } },
    select: { id: true },
  })
  return Boolean(claim)
}

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
