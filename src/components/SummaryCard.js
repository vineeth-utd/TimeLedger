export default function SummaryCard({ label, value, sublabel, icon: Icon, iconColor = 'text-blue-500', large = false }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-default">
      <div className="flex items-start justify-between">
        <p className="text-xs text-foreground-muted uppercase tracking-wide font-medium">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${iconColor} shrink-0`} strokeWidth={2} aria-hidden="true" />}
      </div>
      <p className={`${large ? 'text-3xl font-bold' : 'text-2xl font-semibold'} text-foreground mt-2`}>{value}</p>
      {sublabel && <p className="text-xs text-foreground-subtle mt-1">{sublabel}</p>}
    </div>
  )
}
