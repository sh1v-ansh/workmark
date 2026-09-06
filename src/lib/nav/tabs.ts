/**
 * Which navigation tab the current path belongs to.
 *
 * Split out of Navbar so it can be tested without a DOM. The rule looks
 * trivial and has one trap in it, which is the reason this file exists:
 * `prefix` is only safe on a tab that owns everything beneath it. `/listings`
 * must never set it, because `/listings/new` is a different tab's page — a
 * faculty member creating a project would watch "Find work" light up.
 */
export interface Tab {
  href: string
  label: string
  /** Other exact paths that should light this tab up. */
  also: string[]
  /** Light it up for every path underneath too. See the warning above. */
  prefix?: boolean
}

export function isTabActive(tab: Tab, pathname: string): boolean {
  if (pathname === tab.href) return true
  if (tab.also.includes(pathname)) return true
  // Note the trailing slash: without it "/admin" would also claim
  // "/administrators", and "/me" would claim "/mentors".
  return tab.prefix === true && pathname.startsWith(`${tab.href}/`)
}
