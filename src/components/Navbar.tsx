'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

interface NavbarProps {
  role: 'student' | 'company'
  userName?: string
}

export default function Navbar({ role, userName }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [signing, setSigning] = useState(false)

  async function handleSignOut() {
    setSigning(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    toast('Signed out successfully', 'success')
    router.push('/login')
    router.refresh()
  }

  const dashboardHref = role === 'student' ? '/student/dashboard' : '/company/dashboard'

  return (
    <header className="border-b border-gray-100 bg-white sticky top-0 z-40">
      <nav aria-label="Main navigation" className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={dashboardHref}
          aria-label="Workmark dashboard"
          className="flex items-center gap-2"
        >
          <span className="font-bold text-lg tracking-tight text-gray-900" aria-hidden="true">
            Work<span className="text-brand-600">mark</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/projects"
            aria-current={pathname === '/projects' ? 'page' : undefined}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
          >
            Browse Projects
          </Link>
          {role === 'student' && (
            <Link
              href="/student/dashboard"
              aria-current={pathname === '/student/dashboard' ? 'page' : undefined}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </Link>
          )}
          {role === 'company' && (
            <Link
              href="/company/dashboard"
              aria-current={pathname === '/company/dashboard' ? 'page' : undefined}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
            >
              Dashboard
            </Link>
          )}

          {/* User + sign out */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
            {userName && (
              <span className="hidden sm:block text-sm text-gray-500 truncate max-w-[140px]">
                {userName}
              </span>
            )}
            <button
              onClick={handleSignOut}
              disabled={signing}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {signing ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </nav>
    </header>
  )
}
