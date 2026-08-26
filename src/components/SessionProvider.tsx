'use client'

import { createContext, useContext } from 'react'
import type { Role } from '@/lib/auth/roles'

/**
 * Who's signed in, available to any client component without a prop.
 *
 * This exists because the alternative failed in a way worth recording: the
 * admin menu entry was passed as a prop, and only two of fourteen pages
 * rendering the navbar passed it. So an admin saw no sign of being one
 * anywhere except the dashboard and the admin page itself — the role was
 * granted, stored, and checked correctly, and still invisible.
 *
 * Threading a prop through fourteen call sites would work until the
 * fifteenth. Reading it once in the root layout costs one query per page
 * and cannot be forgotten.
 */
export interface SessionValue {
  signedIn: boolean
  roles: Role[]
  isAdmin: boolean
  isFaculty: boolean
  /** Faculty whose claim a person has actually confirmed. */
  isVerifiedFaculty: boolean
  displayName: string | null
}

const EMPTY: SessionValue = {
  signedIn: false,
  roles: [],
  isAdmin: false,
  isFaculty: false,
  isVerifiedFaculty: false,
  displayName: null,
}

const SessionContext = createContext<SessionValue>(EMPTY)

export function SessionProvider({ value, children }: { value: SessionValue; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

/** Defaults to signed-out rather than throwing — marketing pages have no session. */
export function useSession(): SessionValue {
  return useContext(SessionContext)
}
