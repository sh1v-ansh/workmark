/**
 * Eligibility: self-described identity for opportunities open only to
 * certain groups (see supabase/migrations/v05_0057_eligibility.sql).
 *
 * Used only to decide which opportunities a student is shown. Never shown to
 * anyone else, never used in fit, ranking or matching for roles, never sent
 * to a model. Everything is optional; 'prefer_not' is a real answer.
 */

export const PREFER_NOT = { value: 'prefer_not', label: 'Prefer not to say' } as const

type Option = { value: string; label: string }

const YES_NO: Option[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  PREFER_NOT,
]

export interface SingleQuestion {
  key: 'first_gen' | 'military' | 'gender' | 'disability' | 'lgbtq' | 'low_income' | 'transfer' | 'citizenship'
  label: string
  options: Option[]
}

/** Asked one answer each, in the order the form shows them. */
export const SINGLE_QUESTIONS: SingleQuestion[] = [
  { key: 'first_gen', label: 'Are you the first in your family to go to college?', options: YES_NO },
  {
    key: 'military', label: 'Military connection',
    options: [
      { value: 'veteran', label: 'Veteran' },
      { value: 'active_or_reserve', label: 'Active duty or reserve' },
      { value: 'military_family', label: 'Military spouse or dependent' },
      { value: 'none', label: 'None' },
      PREFER_NOT,
    ],
  },
  {
    key: 'gender', label: 'Gender',
    options: [
      { value: 'woman', label: 'Woman' },
      { value: 'man', label: 'Man' },
      { value: 'non_binary', label: 'Non-binary' },
      { value: 'self_describe', label: 'I describe it differently' },
      PREFER_NOT,
    ],
  },
  { key: 'disability', label: 'Do you have a disability?', options: YES_NO },
  { key: 'lgbtq', label: 'Do you identify as LGBTQ+?', options: YES_NO },
  { key: 'low_income', label: 'Are you from a low-income background or a Pell Grant recipient?', options: YES_NO },
  { key: 'transfer', label: 'Are you a transfer or community college student?', options: YES_NO },
  {
    key: 'citizenship', label: 'Citizenship',
    options: [
      { value: 'citizen', label: 'US citizen' },
      { value: 'permanent_resident', label: 'Permanent resident' },
      { value: 'other', label: 'Other' },
    ],
  },
]

/** Choose all that apply: the 2024 US federal standard categories. */
export const RACE_ETHNICITY: Option[] = [
  { value: 'american_indian_alaska_native', label: 'American Indian or Alaska Native' },
  { value: 'asian', label: 'Asian' },
  { value: 'black', label: 'Black or African American' },
  { value: 'hispanic_latino', label: 'Hispanic or Latino' },
  { value: 'middle_eastern_north_african', label: 'Middle Eastern or North African' },
  { value: 'native_hawaiian_pacific_islander', label: 'Native Hawaiian or Pacific Islander' },
  { value: 'white', label: 'White' },
  PREFER_NOT,
]

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const

export interface Eligibility {
  use_for_opportunities: boolean
  first_gen: string | null
  military: string | null
  gender: string | null
  gender_self: string | null
  race_ethnicity: string[]
  disability: string | null
  lgbtq: string | null
  low_income: string | null
  us_state: string | null
  transfer: string | null
  citizenship: string | null
}

export const EMPTY_ELIGIBILITY: Eligibility = {
  use_for_opportunities: false,
  first_gen: null, military: null, gender: null, gender_self: null, race_ethnicity: [],
  disability: null, lgbtq: null, low_income: null, us_state: null, transfer: null, citizenship: null,
}

/**
 * Whatever arrived, narrowed to exactly what the table accepts. Unknown
 * values become null rather than an error: a stale form or a hand-made
 * request should lose one answer, not the whole save.
 */
export function cleanEligibility(body: unknown): Eligibility {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const out: Eligibility = { ...EMPTY_ELIGIBILITY, race_ethnicity: [] }
  out.use_for_opportunities = input.use_for_opportunities === true

  for (const q of SINGLE_QUESTIONS) {
    const v = input[q.key]
    out[q.key] = typeof v === 'string' && q.options.some((o) => o.value === v) ? v : null
  }

  if (out.gender === 'self_describe' && typeof input.gender_self === 'string') {
    out.gender_self = input.gender_self.trim().slice(0, 60) || null
  }

  if (Array.isArray(input.race_ethnicity)) {
    const allowed = new Set(RACE_ETHNICITY.map((o) => o.value))
    const picked = Array.from(new Set(input.race_ethnicity.filter((v): v is string => typeof v === 'string' && allowed.has(v))))
    // "Prefer not to say" alongside a category is a contradiction; the
    // explicit categories win.
    out.race_ethnicity = picked.length > 1 ? picked.filter((v) => v !== 'prefer_not') : picked
  }

  const state = typeof input.us_state === 'string' ? input.us_state.toUpperCase() : ''
  out.us_state = (US_STATES as readonly string[]).includes(state) ? state : null

  return out
}
