// Weekly report generation states. Keep in sync with the weekly_reports_status_check
// constraint in prisma/migrations/20261011120000_add_productivity_agent_tables.
export const WEEKLY_REPORT_STATUS = Object.freeze({
  GENERATING: 'generating',
  COMPLETED: 'completed',
  FAILED: 'failed',
})

export const WEEKLY_REPORT_STATUSES = Object.freeze(Object.values(WEEKLY_REPORT_STATUS))
