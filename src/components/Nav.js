'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock } from 'lucide-react'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/activities', label: 'Activities' },
  { href: '/categories', label: 'Categories' },
  { href: '/analytics', label: 'Analytics' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors"
        >
          <Clock className="w-5 h-5 text-blue-600" strokeWidth={2} />
          <span className="font-semibold text-sm tracking-tight">TimeLedger</span>
        </Link>

        <div className="flex items-center gap-0.5">
          {links.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
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
