import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do NOT remove this call
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes that require authentication
  const requiresAuth =
    pathname.startsWith('/student/') ||
    pathname.startsWith('/company/') ||
    pathname.startsWith('/onboarding')

  if (!user && requiresAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from /login to their dashboard
  if (user && pathname === '/login') {
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (student) {
      const url = request.nextUrl.clone()
      url.pathname = '/student/dashboard'
      return NextResponse.redirect(url)
    }

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (company) {
      const url = request.nextUrl.clone()
      url.pathname = '/company/dashboard'
      return NextResponse.redirect(url)
    }

    // Logged in but no profile yet → onboarding
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Next.js internals.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
