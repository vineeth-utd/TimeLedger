export default function SummaryCard({ label, value, sublabel }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm">
      <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-semibold text-zinc-900 mt-1">{value}</p>
      {sublabel && <p className="text-xs text-zinc-400 mt-1">{sublabel}</p>}
    </div>
  )
}
