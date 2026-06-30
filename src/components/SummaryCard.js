export default function SummaryCard({ label, value, sublabel, icon: Icon, iconColor = 'text-blue-500' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-default">
      <div className="flex items-start justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${iconColor} shrink-0`} strokeWidth={2} />}
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  )
}
