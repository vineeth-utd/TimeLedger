export default function LoadingState() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" aria-hidden="true" />
      <p className="text-xs text-gray-400">Loading…</p>
    </div>
  )
}
