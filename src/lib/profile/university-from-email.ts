// Working out where somebody studies from the address that got them in.
//
// ── Why derive it rather than ask ─────────────────────────────────────────
// The .edu address is the only thing on the signup form anybody has checked.
// Asking a student to also type their university turns a verified fact into
// a free-text claim sitting next to it — and it is one more field on the
// screen where every field costs somebody.
//
// ── Why it is still shown for confirmation ────────────────────────────────
// Because this is a guess and guesses should say so. A domain maps to an
// institution most of the time and not always: shared systems, satellite
// campuses, a university that renamed. So the answer carries how confident
// it is, the screen states it as a sentence rather than filling a box
// silently, and getting it wrong costs one click rather than a wrong
// university on a public record.

import { UNIVERSITIES } from '@/lib/data/universities'

export type Confidence = 'exact' | 'likely' | 'unknown'

export interface DerivedUniversity {
  name: string | null
  confidence: Confidence
  /** The label the guess was made from — 'umass' out of 'cs.umass.edu'. */
  fromDomain: string | null
}

/**
 * Domains whose name cannot be worked out from the string.
 *
 * Deliberately short. This is not a directory and should never become one —
 * every entry is a domain where the matcher below gets it wrong or gets
 * nothing, and the honest fallback for everywhere else is to ask.
 */
const KNOWN: Record<string, string> = {
  'umass.edu': 'University of Massachusetts Amherst',
  'mit.edu': 'Massachusetts Institute of Technology',
  'berkeley.edu': 'University of California, Berkeley',
  'stanford.edu': 'Stanford University',
  'cmu.edu': 'Carnegie Mellon University',
  'gatech.edu': 'Georgia Institute of Technology',
  'caltech.edu': 'California Institute of Technology',
  'uiuc.edu': 'University of Illinois Urbana-Champaign',
  'illinois.edu': 'University of Illinois Urbana-Champaign',
  'utexas.edu': 'The University of Texas at Austin',
  'ucla.edu': 'University of California, Los Angeles',
  'umich.edu': 'University of Michigan',
  'nyu.edu': 'New York University',
  'bu.edu': 'Boston University',
  'neu.edu': 'Northeastern University',
  'cornell.edu': 'Cornell University',
  'upenn.edu': 'University of Pennsylvania',
  'harvard.edu': 'Harvard University',
  'yale.edu': 'Yale University',
  'princeton.edu': 'Princeton University',
  'columbia.edu': 'Columbia University',
  'uw.edu': 'University of Washington',
  'wisc.edu': 'University of Wisconsin-Madison',
  'purdue.edu': 'Purdue University',
  'rutgers.edu': 'Rutgers University',
  'umd.edu': 'University of Maryland',
  'ucsd.edu': 'University of California, San Diego',
  'usc.edu': 'University of Southern California',
  'rpi.edu': 'Rensselaer Polytechnic Institute',
  'wpi.edu': 'Worcester Polytechnic Institute',
}

/**
 * The part of the domain that names the institution.
 *
 * `priya@cs.umass.edu` and `priya@umass.edu` are the same university, so
 * subdomains are stripped: the label immediately before the public suffix is
 * the one that means something. Handles `.edu`, and `.ac.uk`/`.edu.au` for
 * when the academic-domain rule widens — those have two-part suffixes, which
 * is the thing a naive `split('.')[0]` gets wrong.
 */
export function institutionLabel(domain: string): string | null {
  const parts = domain.toLowerCase().trim().split('.').filter(Boolean)
  if (parts.length < 2) return null

  const tail2 = parts.slice(-2).join('.')
  // ac.uk, edu.au, edu.sg — the institution is one further left.
  const suffixLength = /^(ac|edu)\.[a-z]{2}$/.test(tail2) ? 2 : 1
  const label = parts[parts.length - 1 - suffixLength]
  return label ?? null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Words that appear in hundreds of names and so distinguish nothing. */
const STOPWORDS = new Set([
  'university', 'college', 'the', 'of', 'at', 'state', 'institute',
  'community', 'school', 'and', 'technology', 'technical',
])

function significantWords(name: string): string[] {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * Where this person studies, as far as the address can say.
 *
 * Three answers, and the difference matters to the screen:
 *   exact   — a domain we have written down. State it.
 *   likely  — one university in the list matches the domain label and no
 *             other does. State it, and make it easy to correct.
 *   unknown — nothing, or more than one thing. Ask.
 *
 * "More than one" resolving to unknown is the important half. A label
 * matching two institutions is not a near miss to be broken by ordering —
 * picking the first alphabetically would put a real student at the wrong
 * university on a public record, silently, for the sake of saving a click.
 */
export function universityFromEmail(email: string | null | undefined): DerivedUniversity {
  const domain = email?.split('@')[1]?.toLowerCase().trim()
  if (!domain) return { name: null, confidence: 'unknown', fromDomain: null }

  // The full domain first, then the registrable part, so cs.umass.edu finds
  // the umass.edu entry.
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.')
    if (KNOWN[candidate]) {
      return { name: KNOWN[candidate], confidence: 'exact', fromDomain: candidate }
    }
  }

  const label = institutionLabel(domain)
  if (!label || label.length < 3) {
    return { name: null, confidence: 'unknown', fromDomain: label }
  }

  // A university whose significant words, joined, are exactly the label:
  // 'northwestern' for Northwestern University, 'stonybrook' for Stony Brook.
  const target = normalize(label)
  const matches = UNIVERSITIES.filter((u) => {
    const words = significantWords(u)
    if (words.length === 0) return false
    return normalize(words.join('')) === target
  })

  if (matches.length === 1) {
    return { name: matches[0], confidence: 'likely', fromDomain: label }
  }

  return { name: null, confidence: 'unknown', fromDomain: label }
}
