import { describe, it, expect } from 'vitest'
import { isTabActive, type Tab } from '../src/lib/nav/tabs'
import { lastScanLabel } from '../src/lib/github/last-scan'

const HOME: Tab = { href: '/student/dashboard', label: 'Home', also: ['/goals'] }
const FIND: Tab = { href: '/listings', label: 'Find work', also: [] }
const RECORD: Tab = { href: '/me', label: 'My record', also: ['/me/file', '/me/briefs', '/student/github'] }
const ADMIN: Tab = { href: '/admin', label: 'Admin', also: [], prefix: true }

describe('isTabActive', () => {
  it('lights the tab you are on', () => {
    expect(isTabActive(HOME, '/student/dashboard')).toBe(true)
    expect(isTabActive(FIND, '/listings')).toBe(true)
  })

  it('lights a tab for the pages it owns', () => {
    expect(isTabActive(RECORD, '/me/file')).toBe(true)
    expect(isTabActive(RECORD, '/student/github')).toBe(true)
    expect(isTabActive(HOME, '/goals')).toBe(true)
  })

  it('lights only one tab at a time on a shared path', () => {
    const lit = [HOME, FIND, RECORD].filter((t) => isTabActive(t, '/me/briefs'))
    expect(lit).toEqual([RECORD])
  })

  it('follows an admin down into its sub-pages', () => {
    expect(isTabActive(ADMIN, '/admin')).toBe(true)
    expect(isTabActive(ADMIN, '/admin/queue')).toBe(true)
    expect(isTabActive(ADMIN, '/admin/people')).toBe(true)
  })

  // The reason isTabActive is a separate function at all. Without prefix,
  // /listings must not claim /listings/new — that page belongs to a faculty
  // member's "My projects" tab, and lighting "Find work" there would tell
  // them they are somewhere they are not.
  it('does not let a tab claim a sub-path it was not given', () => {
    expect(isTabActive(FIND, '/listings/new')).toBe(false)
    expect(isTabActive(FIND, '/listings/abc-123')).toBe(false)
    expect(isTabActive(RECORD, '/me/something-new')).toBe(false)
  })

  // The trailing slash in the prefix check. "/admin" must not swallow a
  // future "/administrators".
  it('does not match a path that merely starts with the same letters', () => {
    expect(isTabActive(ADMIN, '/administrators')).toBe(false)
  })
})

describe('lastScanLabel', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

  it('says so when there has never been a scan', () => {
    expect(lastScanLabel(null)).toBe('Not scanned yet')
    expect(lastScanLabel('not a date')).toBe('Not scanned yet')
  })

  it('reads as words, not a timestamp', () => {
    expect(lastScanLabel(ago(10_000))).toBe('Scanned just now')
    expect(lastScanLabel(ago(5 * 60_000))).toBe('Scanned 5 minutes ago')
    expect(lastScanLabel(ago(3 * 3_600_000))).toBe('Scanned 3 hours ago')
    expect(lastScanLabel(ago(4 * 86_400_000))).toBe('Scanned 4 days ago')
    expect(lastScanLabel(ago(70 * 86_400_000))).toBe('Scanned 2 months ago')
  })

  it('gets the singular right', () => {
    expect(lastScanLabel(ago(61_000))).toBe('Scanned 1 minute ago')
    expect(lastScanLabel(ago(3_600_000 + 1000))).toBe('Scanned 1 hour ago')
    expect(lastScanLabel(ago(86_400_000 + 1000))).toBe('Scanned 1 day ago')
  })
})
