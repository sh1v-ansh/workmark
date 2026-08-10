import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll(): { name: string; value: string }[] {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Set on request (for current execution)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          // Create new response and persist cookies
          supabaseResponse = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session — REQUIRED
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Student-only in MVP. Company and faculty accounts are deferred until
  // Tier 1+ — their tables don't exist in the v0.5 schema at all, so
  // there's nothing to route to.
  const requiresAuth =
    pathname.startsWith('/student/') ||
    pathname.startsWith('/listings/new') ||
    pathname.startsWith('/onboarding')

  if (!user && requiresAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const url = request.nextUrl.clone()
    url.pathname = student ? '/student/dashboard' : '/onboarding'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
