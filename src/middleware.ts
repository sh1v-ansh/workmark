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

  const requiresAuth =
    pathname.startsWith('/student/') ||
    pathname.startsWith('/faculty') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/listings/new') ||
    pathname.startsWith('/onboarding')

  // The admin role itself is checked in the page and the API route, against
  // the database rather than the login token — a token claim goes stale, and
  // admin is exactly the role where that gap matters. This only ensures a
  // signed-out visitor is bounced to login rather than reaching a page that
  // then has to decide whether to admit its own existence.

  if (!user && requiresAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const [{ data: student }, { data: account }] = await Promise.all([
      supabase.from('students').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('accounts').select('roles').eq('id', user.id).maybeSingle(),
    ])

    // Faculty land on their own home. The student dashboard asks about
    // skills, a record and a GitHub connection, none of which a professor
    // has — and someone who also holds the student role is a student first,
    // since that's the side of the product they're being scored on.
    const roles = (account?.roles ?? []) as string[]
    const facultyOnly = roles.includes('faculty') && !roles.includes('student')

    const url = request.nextUrl.clone()
    url.pathname = !student ? '/onboarding' : facultyOnly ? '/faculty' : '/student/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
