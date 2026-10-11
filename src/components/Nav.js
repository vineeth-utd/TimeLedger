'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Clock, Menu, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

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
  const isLoginPage = pathname === '/login'

  return (
    <nav aria-label="Main navigation" className="bg-surface border-b border-border sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between min-h-14">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
        >
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={2} />
          <span className="font-semibold text-sm tracking-tight">TimeLedger</span>
        </Link>

        {isLoginPage ? null : isAuthenticated ? (
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
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'text-foreground-muted hover:text-foreground hover:bg-surface-muted'
                    }`}
                  >
                    {label}
                  </Link>
                )
              })}
              <ThemeToggle className="ml-1" />
              <button
                type="button"
                onClick={handleAuthAction}
                className="ml-1 px-3 py-1.5 rounded-md text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
              >
                {authActionLabel}
              </button>
            </div>

            {/* Mobile: theme toggle + hamburger */}
            <div className="md:hidden flex items-center gap-0.5">
              <ThemeToggle />
              <button
                className="p-2 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
                aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="w-5 h-5" strokeWidth={2} /> : <Menu className="w-5 h-5" strokeWidth={2} />}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={handleAuthAction}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            {authActionLabel}
          </button>
        )}
      </div>

      {/* Mobile menu */}
      {!isLoginPage && isAuthenticated && open && (
        <div id="mobile-nav" className="md:hidden border-t border-border-subtle bg-surface px-4 py-2">
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
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'text-foreground-secondary hover:text-foreground hover:bg-surface-muted'
                }`}
              >
                {label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={handleAuthAction}
            className="mt-2 block w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-foreground-secondary hover:text-foreground hover:bg-surface-muted transition-colors"
          >
            {authActionLabel}
          </button>
        </div>
      )}
    </nav>
  )
}
