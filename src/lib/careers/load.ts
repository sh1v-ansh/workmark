import type { SupabaseClient } from '@supabase/supabase-js'
import { trackById } from './tracks'
import { trackProgress, type TrackProgress } from './next-skill'

export interface CareerView {
  trackId: string | null
  aspiration: string | null
  progress: TrackProgress | null
  /** Display names for every skill the track mentions. */
  names: Record<string, string>
}

/**
 * The student's track and where they are on it. Two small reads: the
 * student row and the names of the track's skills. Levels come from the
 * caller, who has already loaded the record.
 */
export async function loadCareer(
  supabase: SupabaseClient,
  studentId: string,
  levels: Map<string, number>,
): Promise<CareerView> {
  const { data: row } = await supabase
    .from('students')
    .select('career_track, aspiration')
    .eq('id', studentId)
    .maybeSingle()
  const track = trackById(row?.career_track as string | null)
  if (!track) return { trackId: null, aspiration: (row?.aspiration as string | null) ?? null, progress: null, names: {} }

  const ids = Array.from(new Set(track.slots.flatMap((s) => s.skills)))
  const { data: skills } = await supabase.from('skills').select('id, canonical_name').in('id', ids)
  const names: Record<string, string> = {}
  for (const s of skills ?? []) names[s.id as string] = s.canonical_name as string

  return {
    trackId: track.id,
    aspiration: (row?.aspiration as string | null) ?? null,
    progress: trackProgress(track, levels),
    names,
  }
}

/** The project level to ask for when building a skill from where they are. */
export function projectLevelFor(currentLevel: number): 'beginner' | 'intermediate' | 'advanced' {
  return currentLevel >= 2 ? 'advanced' : currentLevel === 1 ? 'intermediate' : 'beginner'
}

export function buildLink(skillId: string, name: string, currentLevel: number): string {
  const q = new URLSearchParams({ generate: skillId, name, level: projectLevelFor(currentLevel) })
  return `/me/briefs?${q.toString()}`
}
