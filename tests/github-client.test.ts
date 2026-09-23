import { describe, it, expect } from 'vitest'
import { Octokit as RestOctokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import { retry } from '@octokit/plugin-retry'

/**
 * Proof that the client can be built at all.
 *
 * plugin-throttling refuses to construct without its two handlers, by
 * design. They were being passed to the App constructor, which does not
 * forward them to the Octokit instances it creates — so every installation
 * client threw, inside getInstallationOctokit, which is the first line of
 * scanRepo. Every scan of every repository failed at step one, and a rescan
 * that appeared to complete had done nothing.
 *
 * Nothing caught it: typecheck passed, the unit tests never construct a
 * client, and the scan's own error handling reported it as an ordinary
 * per-repo failure. This is the cheapest test that would have.
 */
describe('the GitHub client', () => {
  const HANDLERS = {
    onRateLimit: () => false,
    onSecondaryRateLimit: () => false,
  }

  it('cannot be built without the throttle handlers', () => {
    const Bare = RestOctokit.plugin(throttling, retry)
    expect(() => new Bare({ auth: 'x' })).toThrow(/onSecondaryRateLimit|onRateLimit/)
  })

  // The fix: baked into the class, so every instance carries them however it
  // was constructed and by whom — including the ones @octokit/app builds.
  it('builds when the handlers are class defaults', () => {
    const Configured = RestOctokit.plugin(throttling, retry).defaults({ throttle: HANDLERS })
    expect(() => new Configured({ auth: 'x' })).not.toThrow()
  })

  it('still builds when constructed with no options at all', () => {
    const Configured = RestOctokit.plugin(throttling, retry).defaults({ throttle: HANDLERS })
    expect(() => new Configured()).not.toThrow()
  })
})
