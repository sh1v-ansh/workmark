import { describe, it, expect, afterEach } from 'vitest'
import { workerReachable } from '../src/lib/jobs/queue'
import { slugify } from '../src/lib/agents/taxonomy'

const ORIGINAL = { ...process.env }
afterEach(() => { process.env = { ...ORIGINAL } })

describe('refusing to start a scan that cannot run', () => {
  // The exact bug this prevents: the job was created, the kick failed for
  // want of a secret, the failure went to a console nobody reads, and the
  // student watched 0/25 forever — surviving logout, with no way to tell it
  // was never going to start.
  it('refuses when there is no worker secret', () => {
    delete process.env.CRON_SECRET
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    const r = workerReachable()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/CRON_SECRET/)
  })

  it('refuses when it cannot work out its own address', () => {
    process.env.CRON_SECRET = 'secret'
    delete process.env.VERCEL_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    const r = workerReachable()
    expect(r.ok).toBe(false)
  })

  it('allows it when both are present', () => {
    process.env.CRON_SECRET = 'secret'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
    expect(workerReachable().ok).toBe(true)
  })
})

describe('slugify for new taxonomy nodes', () => {
  it('produces a stable id from a display name', () => {
    expect(slugify('Pydantic')).toBe('pydantic')
    expect(slugify('Protocol Buffers')).toBe('protocol-buffers')
    expect(slugify('CUDA / GPU Programming')).toBe('cuda-gpu-programming')
  })

  it('never leaves leading or trailing separators', () => {
    expect(slugify('  Web APIs!  ')).toBe('web-apis')
    expect(slugify('C++')).toBe('c')
  })
})
