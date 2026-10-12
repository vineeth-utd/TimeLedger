import crypto from 'node:crypto'
import { handleRouteError } from '@/lib/errors'
import { processScheduledWeeklyReports } from '@/lib/services/weeklyReportSchedulerService'

export const maxDuration = 60

export function isAuthorizedCronRequest(request) {
  const secret = process.env.CRON_SECRET
  if (!secret || typeof secret !== 'string') {
    return false
  }
  const authHeader = request.headers.get('authorization')
  if (!authHeader || typeof authHeader !== 'string') {
    return false
  }
  const expected = `Bearer ${secret}`
  const authBuffer = Buffer.from(authHeader)
  const expectedBuffer = Buffer.from(expected)
  if (authBuffer.length !== expectedBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(authBuffer, expectedBuffer)
}

export async function GET(request) {
  try {
    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET is not configured')
      return Response.json({ success: false, message: 'Server misconfiguration' }, { status: 500 })
    }
    if (!isAuthorizedCronRequest(request)) {
      return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    const result = await processScheduledWeeklyReports()
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'GET /api/cron/weekly-reports')
  }
}

