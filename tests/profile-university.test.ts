import { describe, it, expect } from 'vitest'
import { universityFromEmail, institutionLabel } from '../src/lib/profile/university-from-email'
import { cleanIntents, nextStepFor, type Intent } from '../src/lib/profile/intents'

describe('institutionLabel', () => {
  it('takes the label before the suffix', () => {
    expect(institutionLabel('umass.edu')).toBe('umass')
  })

  // A department subdomain is the same university.
  it('ignores subdomains', () => {
    expect(institutionLabel('cs.umass.edu')).toBe('umass')
    expect(institutionLabel('mail.student.cs.umass.edu')).toBe('umass')
  })

  // The thing a naive split('.')[0] gets wrong: these suffixes are two parts,
  // so the institution is one label further left.
  it('handles two-part academic suffixes', () => {
    expect(institutionLabel('ox.ac.uk')).toBe('ox')
    expect(institutionLabel('unimelb.edu.au')).toBe('unimelb')
  })

  it('has nothing to say about a bare word', () => {
    expect(institutionLabel('localhost')).toBeNull()
  })
})

describe('universityFromEmail', () => {
  it('knows the domains we have written down', () => {
    const d = universityFromEmail('priya@umass.edu')
    expect(d.name).toBe('University of Massachusetts Amherst')
    expect(d.confidence).toBe('exact')
  })

  it('finds them through a department subdomain', () => {
    expect(universityFromEmail('priya@cs.umass.edu').name)
      .toBe('University of Massachusetts Amherst')
  })

  it('works one out from the list when the label matches exactly one', () => {
    const d = universityFromEmail('someone@vanderbilt.edu')
    expect(d.name).toBe('Vanderbilt University')
    expect(d.confidence).toBe('likely')
  })

  // The important half, and a real case rather than an invented one:
  // 'northwestern' is both Northwestern University and Northwestern State
  // University. Breaking that tie by list order would put a real student at
  // the wrong university on a public record, silently, to save a click.
  it('refuses to guess when the label could be two places', () => {
    const d = universityFromEmail('someone@northwestern.edu')
    expect(d.name).toBeNull()
    expect(d.confidence).toBe('unknown')
  })

  it('says nothing for a domain in no list at all', () => {
    expect(universityFromEmail('someone@nosuchplaceatall.edu').confidence).toBe('unknown')
  })

  it('says nothing for an address it cannot read', () => {
    expect(universityFromEmail(null).confidence).toBe('unknown')
    expect(universityFromEmail('not-an-address').confidence).toBe('unknown')
    expect(universityFromEmail('').confidence).toBe('unknown')
  })

  it('does not care about case', () => {
    expect(universityFromEmail('Priya@UMass.EDU').name)
      .toBe('University of Massachusetts Amherst')
  })
})

describe('cleanIntents', () => {
  it('keeps the ones it recognises, in a stable order', () => {
    expect(cleanIntents(['post_project', 'build_record']))
      .toEqual(['build_record', 'post_project'])
  })

  it('drops anything else rather than refusing the answer', () => {
    expect(cleanIntents(['build_record', 'nonsense', 42, null]))
      .toEqual(['build_record'])
  })

  it('copes with nothing at all', () => {
    expect(cleanIntents(undefined)).toEqual([])
    expect(cleanIntents('build_record')).toEqual([])
  })

  it('does not repeat one that was sent twice', () => {
    expect(cleanIntents(['build_record', 'build_record'])).toEqual(['build_record'])
  })
})

describe('nextStepFor', () => {
  const base = { intents: [] as Intent[], githubConnected: true, repoCount: 4, evidenceCount: 9 }

  it('asks for GitHub before anything else', () => {
    expect(nextStepFor({ ...base, githubConnected: false, intents: ['post_project'] }))
      .toBe('connect_github')
  })

  // The freshman case, and a large share of the waitlist. Reading an empty
  // account, finding nothing and showing an empty record is accurate and
  // lands as a verdict on somebody who has not had the chance yet.
  it('offers a project to build when there is nothing to scan', () => {
    expect(nextStepFor({ ...base, repoCount: 0, evidenceCount: 0 }))
      .toBe('start_guided_project')
  })

  it('does that whatever they said they wanted', () => {
    expect(nextStepFor({ ...base, repoCount: 0, evidenceCount: 0, intents: ['post_project'] }))
      .toBe('start_guided_project')
  })

  it('asks for a scan when there are repositories but no record yet', () => {
    expect(nextStepFor({ ...base, evidenceCount: 0 })).toBe('scan')
  })

  it('honours what they picked once they have a record', () => {
    expect(nextStepFor({ ...base, intents: ['post_project'] })).toBe('post_project')
    expect(nextStepFor({ ...base, intents: ['join_project'] })).toBe('find_work')
  })

  it('asks people after collaborators to be findable first', () => {
    expect(nextStepFor({ ...base, intents: ['post_project'], openToCollab: false })).toBe('be_discoverable')
    expect(nextStepFor({ ...base, intents: ['join_project'], openToCollab: false })).toBe('be_discoverable')
    expect(nextStepFor({ ...base, intents: ['guided_project'], openToCollab: false })).toBe('start_guided_project')
  })

  it('stops asking for a project once one is posted', () => {
    expect(nextStepFor({ ...base, intents: ['post_project'], openToCollab: true, postedCount: 1 })).toBe('nothing')
    expect(nextStepFor({ ...base, intents: ['post_project', 'join_project'], openToCollab: true, postedCount: 1 })).toBe('find_work')
  })

  // Posting first when both are picked: it is the one that needs somebody
  // else to have acted, so it is the one worth starting earliest.
  it('leads with posting when they want both', () => {
    expect(nextStepFor({ ...base, intents: ['join_project', 'post_project'] }))
      .toBe('post_project')
  })

  it('has nothing to push when they only wanted a record and have one', () => {
    expect(nextStepFor({ ...base, intents: ['build_record'] })).toBe('nothing')
  })
})
