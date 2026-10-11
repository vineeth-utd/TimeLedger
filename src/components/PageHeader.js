export default function PageHeader({ title, subtitle, children }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      {subtitle && <p className="text-sm text-foreground-muted mt-1">{subtitle}</p>}
      {children}
    </div>
  )
}
