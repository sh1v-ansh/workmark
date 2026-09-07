import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  destinationAfterSignIn,
  landingForStatus,
  STATUS_PAGE,
  DELETED_PAGE,
} from '@/lib/auth/post-signin'

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
  // A deletion inside its grace period is also "not active", but the page it
  // needs is the one with the Restore button on it rather than one about
  // suspended and declined accounts. landingForStatus knows which.
  const EXEMPT = new Set([STATUS_PAGE, DELETED_PAGE])

  if (user && requiresAuth && !EXEMPT.has(pathname)) {
    const { data: current } = await supabase
      .from('accounts')
      .select('status')
      .eq('id', user.id)
      .maybeSingle()

    if (current && current.status !== 'active') {
      const url = request.nextUrl.clone()
      url.pathname = landingForStatus(current.status)
      return NextResponse.redirect(url)
    }
  }

  if (user && pathname === '/login') {
    const [{ data: student }, { data: account }] = await Promise.all([
      supabase.from('students').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('accounts').select('roles, status').eq('id', user.id).maybeSingle(),
    ])

    // The same rule the sign-in route answers with, from the same function —
    // it used to be written out here and nowhere else, and then the sign-in
    // route needed it too.
    const url = request.nextUrl.clone()
    url.pathname = destinationAfterSignIn({
      hasAccount: !!account,
      status: (account?.status as string | undefined) ?? null,
      roles: (account?.roles ?? []) as string[],
      hasStudentProfile: !!student,
    })
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
