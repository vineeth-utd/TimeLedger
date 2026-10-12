import { formatWeekRange } from '@/components/productivity-agent/reportFormat'

const STATUS_LABELS = { completed: 'Ready', generating: 'In progress', failed: 'Failed' }

export default function ReportHistory({ reports, selectedId, onSelect }) {
  return (
    <ul className="space-y-1" aria-label="Report history">
      {reports.map((report, index) => {
        const selected = report.id === selectedId
        return (
          <li key={report.id}>
            <button
              type="button"
              onClick={() => onSelect(report.id)}
              aria-current={selected ? 'true' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm text-left transition-colors ${
                selected
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-surface-muted'
              }`}
            >
              <span className="font-medium">{formatWeekRange(report.weekStartDate)}</span>
              <span className="text-xs text-foreground-muted shrink-0">
                {index === 0 && report.status === 'completed' ? 'Latest · ' : ''}
                {STATUS_LABELS[report.status] ?? report.status}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
