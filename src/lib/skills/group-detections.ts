// Joining what a scan saw to what it resolved to.
//
// ── The bug this module exists to make impossible to reintroduce ──────────
// canonicalizeSkills keys its results by the normalised string — trimmed and
// lowercased — and the loop that consumed them looked each detection up by
// its raw string. So `react`, read out of a package.json, found its result,
// and `TypeScript`, `Go`, `Java`, `CUDA`, `Claude Code` and `Cursor` never
// did. Everything GitHub's language statistics reported, and every AI coding
// tool, was resolved correctly and then silently dropped on the way to the
// record — from 26 August onward, for every student.
//
// That is why systems projects with no npm or pip manifest scanned as
// "nothing recognisable", why Claude Code never appeared whatever its
// relevance was set to, and why a stale skill on one of those repositories
// could never be retracted: a repository that resolves nothing never reaches
// the retraction step.
//
// The fix is one call to the same normaliser. It lives here, exported and
// tested, so the key used to look up a result is by construction the key it
// was stored under.

import type { Detection } from '@/lib/github/detectors'

/** The single definition of the key a raw detection is resolved under. */
export function resolutionKey(raw: string): string {
  return raw.trim().toLowerCase()
}

export interface Resolution {
  resolved: boolean
  skillId: string | null
}

export function groupDetections(
  detections: Detection[],
  canonicalized: Map<string, Resolution>,
): { provenance: Map<string, string[]>; detectionsBySkill: Map<string, Detection[]> } {
  const provenance = new Map<string, string[]>()
  const detectionsBySkill = new Map<string, Detection[]>()

  for (const d of detections) {
    const resolved = canonicalized.get(resolutionKey(d.raw))
    if (!resolved?.resolved || !resolved.skillId) continue
    const places = provenance.get(resolved.skillId) ?? []
    if (!places.includes(d.where)) places.push(d.where)
    provenance.set(resolved.skillId, places)
    detectionsBySkill.set(resolved.skillId, [...(detectionsBySkill.get(resolved.skillId) ?? []), d])
  }

  return { provenance, detectionsBySkill }
}
