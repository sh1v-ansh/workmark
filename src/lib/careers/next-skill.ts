import type { CareerTrack, TrackSlot } from './tracks'

/**
 * The next skill to work on for a career track, from verified levels alone.
 * No model call: the same record always gets the same answer.
 *
 * Only the earliest unfinished stage is considered, so nobody is sent to
 * Kubernetes before Linux. Inside it, the biggest gap weighted by
 * importance wins; ties go to the order the track lists them.
 */

// Which language a framework is written in, so a Python student missing
// "a backend framework" is pointed at FastAPI rather than Express.
const LANGUAGE_OF: Record<string, string[]> = {
  express: ['javascript', 'typescript'], nestjs: ['typescript', 'javascript'], nodejs: ['javascript', 'typescript'],
  fastapi: ['python'], django: ['python'], flask: ['python'], spring: ['java', 'kotlin'], dotnet: ['c#'],
  laravel: ['php'], 'react-native': ['javascript', 'typescript'], flutter: ['dart'], swiftui: ['swift'],
  'jetpack-compose': ['kotlin'], 'ios-development': ['swift'], 'android-development': ['kotlin', 'java'],
  pytorch: ['python'], tensorflow: ['python'],
}

export interface SlotStatus {
  slot: TrackSlot
  /** The skill in the slot the student is strongest in, or the one to start with. */
  skillId: string
  level: number
  done: boolean
}

export interface NextSkill {
  skillId: string
  slotLabel: string
  currentLevel: number
  targetLevel: number
  stage: number
}

export interface TrackProgress {
  slots: SlotStatus[]
  done: number
  total: number
  next: NextSkill | null
}

function pickSkill(slot: TrackSlot, levels: Map<string, number>): { skillId: string; level: number } {
  let best = { skillId: slot.skills[0], level: 0 }
  for (const id of slot.skills) {
    const level = levels.get(id) ?? 0
    if (level > best.level) best = { skillId: id, level }
  }
  if (best.level > 0) return best
  // Nothing yet: prefer one that builds on a language they already have.
  const fits = slot.skills.find((id) => (LANGUAGE_OF[id] ?? []).some((lang) => (levels.get(lang) ?? 0) > 0))
  return { skillId: fits ?? slot.skills[0], level: 0 }
}

export function trackProgress(track: CareerTrack, levels: Map<string, number>): TrackProgress {
  const slots = track.slots.map((slot) => {
    const { skillId, level } = pickSkill(slot, levels)
    return { slot, skillId, level, done: level >= slot.target }
  })

  const open = slots.filter((s) => !s.done)
  let next: NextSkill | null = null
  if (open.length > 0) {
    const stage = Math.min(...open.map((s) => s.slot.stage))
    const candidates = open.filter((s) => s.slot.stage === stage)
    const score = (s: SlotStatus) => s.slot.importance * (s.slot.target - s.level)
    const pick = candidates.reduce((a, b) => (score(b) > score(a) ? b : a))
    next = {
      skillId: pick.skillId,
      slotLabel: pick.slot.label,
      currentLevel: pick.level,
      targetLevel: pick.slot.target,
      stage,
    }
  }

  return { slots, done: slots.length - open.length, total: slots.length, next }
}
