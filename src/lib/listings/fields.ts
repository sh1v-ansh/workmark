import { readFields, requireString, requireArray, ValidationError } from '@/lib/http/validate'
import { isListingKind, type ListingKind } from '@/lib/listings/kinds'
import { QUESTION_COUNT, type ApplicationQuestion } from '@/lib/applications/questions'

/**
 * What a listing form sends, checked once for both posting and editing.
 *
 * Shared so an edit can never accept something a new post would refuse —
 * the two used to be able to drift, and an edit is the easier one to forget.
 */
export interface ListingFields {
  kind: ListingKind
  title: string
  brief: string
  requirements: { skillId: string; requiredLevel: number }[]
  est_hours: number | null
  hours_per_week: number | null
  duration: string | null
  work_mode: string | null
  team_size: number | null
  /** The poster's own questions, or null for the standard pair. */
  application_questions: ApplicationQuestion[] | null
  declared_difficulty: number | null
}

const WORK_MODES = ['remote', 'in-person', 'hybrid']

// The numbers were passed straight through before, so a string or a
// negative reached the database and came back as a 500.
function wholeNumber(value: unknown, field: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(`${field} must be a whole number from ${min} to ${max}.`)
  }
  return value
}

export function parseListingFields(body: Record<string, unknown>) {
  return readFields((): ListingFields => {
    if (!isListingKind(body.kind)) {
      throw new ValidationError('Choose what kind of posting this is.')
    }
    const kind = body.kind
    const title = requireString(body.title, 'A title', { max: 200 })
    const brief = requireString(body.brief, 'A brief', { max: 8000 })
    const raw = requireArray(body.requirements ?? [], 'Requirements', { max: 20 }) as { skillId?: unknown; requiredLevel?: unknown }[]
    const requirements = raw
      .filter((r) =>
        r && typeof r === 'object' &&
        typeof r.skillId === 'string' && r.skillId.length > 0 && r.skillId.length <= 120 &&
        typeof r.requiredLevel === 'number' && Number.isInteger(r.requiredLevel) &&
        r.requiredLevel >= 1 && r.requiredLevel <= 5)
      .map((r) => ({ skillId: r.skillId as string, requiredLevel: r.requiredLevel as number }))
    if (requirements.length === 0) {
      throw new ValidationError('Add at least one required skill so applicants can be matched.')
    }

    const duration = typeof body.duration === 'string' && body.duration.trim() ? body.duration.trim().slice(0, 60) : null
    const workMode = typeof body.work_mode === 'string' && WORK_MODES.includes(body.work_mode) ? body.work_mode : null

    return {
      kind,
      title,
      brief,
      requirements,
      est_hours: wholeNumber(body.est_hours, 'Total hours', 1, 2000),
      hours_per_week: wholeNumber(body.hours_per_week, 'Hours per week', 1, 60),
      duration,
      work_mode: workMode,
      team_size: wholeNumber(body.team_size, 'Team size', 1, 20),
      application_questions: parseQuestions(body.application_questions),
      declared_difficulty: wholeNumber(body.declared_difficulty, 'Difficulty', 1, 10),
    }
  })
}

/**
 * The poster's questions. Blank ones are dropped; none at all means the
 * standard pair. A question keeps its kind when it came from the suggest
 * button, and is 'custom' when the poster wrote or reworded it.
 */
function parseQuestions(value: unknown): ApplicationQuestion[] | null {
  if (!Array.isArray(value)) return null
  const KINDS = ['cut', 'tradeoff', 'risk', 'assumption', 'critique', 'custom']
  const out = value
    .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
    .map((q, i) => ({
      id: `q${i}`,
      kind: (typeof q.kind === 'string' && KINDS.includes(q.kind) ? q.kind : 'custom') as ApplicationQuestion['kind'],
      prompt: typeof q.prompt === 'string' ? q.prompt.trim().slice(0, 300) : '',
      hint: typeof q.hint === 'string' ? q.hint.trim().slice(0, 160) : '',
    }))
    .filter((q) => q.prompt.length >= 10)
    .slice(0, QUESTION_COUNT)
  if (value.some((q) => q && typeof q === 'object' && typeof (q as Record<string, unknown>).prompt === 'string'
    && ((q as Record<string, unknown>).prompt as string).trim().length > 0 && ((q as Record<string, unknown>).prompt as string).trim().length < 10)) {
    throw new ValidationError('Each application question needs at least 10 characters.')
  }
  return out.length > 0 ? out : null
}
