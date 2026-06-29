export default function PageHeader({ title, subtitle, children }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
      {children}
    </div>
  )
}
