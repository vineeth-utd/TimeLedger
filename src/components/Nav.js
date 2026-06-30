'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Clock, Menu, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/activities', label: 'Activities' },
  { href: '/categories', label: 'Categories' },
  { href: '/analytics', label: 'Analytics' },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  async function handleAuthAction() {
    setOpen(false)

    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    await supabase.auth.signOut()
    router.replace('/login')
  }

  useEffect(() => {
    let ignore = false

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!ignore) {
          setIsAuthenticated(Boolean(session?.user))
        }
      })
      .catch(() => {
        if (!ignore) {
          setIsAuthenticated(false)
        }
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ignore) {
        setIsAuthenticated(Boolean(session?.user))
      }
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const authActionLabel = isAuthenticated ? 'Sign Out' : 'Sign In'

  return (
    <nav aria-label="Main navigation" className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between min-h-14">
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors shrink-0"
        >
          <Clock className="w-5 h-5 text-blue-600" strokeWidth={2} />
          <span className="font-semibold text-sm tracking-tight">TimeLedger</span>
        </Link>

        {isAuthenticated ? (
          <>
            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-0.5">
              {links.map(({ href, label }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
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
              <button
                type="button"
                onClick={handleAuthAction}
                className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                {authActionLabel}
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="w-5 h-5" strokeWidth={2} /> : <Menu className="w-5 h-5" strokeWidth={2} />}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleAuthAction}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            {authActionLabel}
          </button>
        )}
      </div>

      {/* Mobile menu */}
      {isAuthenticated && open && (
        <div id="mobile-nav" className="md:hidden border-t border-gray-100 bg-white px-4 py-2">
          {links.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={handleAuthAction}
            className="mt-2 block w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            {authActionLabel}
          </button>
        </div>
      )}
    </nav>
  )
}
