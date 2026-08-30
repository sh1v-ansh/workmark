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
    pathname.startsWith('/account/') ||
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

  // An account that exists but isn't active — suspended, or a declined
  // faculty claim. Every protected page calls getAccount(), which returns
  // nothing for these, so the page bounces them to /login, which sees a
  // valid session and bounces them back. They loop until they give up.
  //
  // This predates the faculty work: suspending anyone already did it. One
  // page that says what happened ends the loop for every reason at once.
  const STATUS_PAGE = '/account/status'

  if (user && requiresAuth && pathname !== STATUS_PAGE) {
    const { data: current } = await supabase
      .from('accounts')
      .select('status')
      .eq('id', user.id)
      .maybeSingle()

    if (current && current.status !== 'active') {
      const url = request.nextUrl.clone()
      url.pathname = STATUS_PAGE
      return NextResponse.redirect(url)
    }
  }

  if (user && pathname === '/login') {
    const [{ data: student }, { data: account }] = await Promise.all([
      supabase.from('students').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('accounts').select('roles, status').eq('id', user.id).maybeSingle(),
    ])

    // Faculty land on their own home. The student dashboard asks about
    // skills, a record and a GitHub connection, none of which a professor
    // has — and someone who also holds the student role is a student first,
    // since that's the side of the product they're being scored on.
    const roles = (account?.roles ?? []) as string[]
    const facultyOnly = roles.includes('faculty') && !roles.includes('student')

    // "Has an account row" is what finished onboarding means, not "has a
    // student row". Faculty have no student row by design, so keying off
    // `students` sent every professor back to the signup form forever.
    const url = request.nextUrl.clone()
    url.pathname = !account
      ? '/onboarding'
      : account.status !== 'active'
        ? STATUS_PAGE
        : facultyOnly
          ? '/faculty'
          : student
            ? '/student/dashboard'
            // An account with the student role but no profile is a signup
            // that stopped halfway. Finish it rather than landing on a
            // dashboard with nothing behind it.
            : '/onboarding'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
