'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/activities', label: 'Activities' },
  { href: '/categories', label: 'Categories' },
  { href: '/analytics', label: 'Analytics' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-8">
        <span className="font-semibold text-zinc-900 text-sm tracking-tight">TimeLedger</span>
        <div className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
