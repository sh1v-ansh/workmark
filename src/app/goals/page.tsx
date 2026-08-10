import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { analyzeGoal, gapClosedByListing } from '@/lib/matching/goals'
import { getStudentDepth } from '@/lib/matching/depth'
import { getListingRequirements, getApplicantPools } from '@/lib/matching/listing'
import { computeFit, assignTier } from '@/lib/matching/fit'
import { agentsAvailable } from '@/lib/agents/client'
import GoalsClient, { type GoalsData } from './GoalsClient'

/**
 * /goals — the student agent (§8).
 *
 * Answers the reverse of every other page: not "how do I compare on this
 * listing" but "what am I missing, and what should I do about it".
 *
 * Entirely deterministic. The target vector is derived by counting what
 * open listings actually ask for; the gap is a set difference against the
 * student's evidence. The only agent involvement is the hand-off at the
 * end, where a named gap becomes a project brief — and that's the
 * already-audited brief call.
 */
export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: student } = await supabase
    .from('students')
    .select('full_name, active_application_count')
    .eq('id', user.id)
    .maybeSingle()
  if (!student) redirect('/onboarding')

  // Every open listing the student didn't post. Scope is deliberately the
  // whole open market rather than a keyword filter on job titles — the
  // platform can verify what listings ask for, not what a role is called.
  const { data: openListings } = await supabase
    .from('listings')
    .select('id, title, brief, poster_display_name, poster_id')
    .eq('status', 'open')
    .neq('poster_id', user.id)
    .order('created_at', { ascending: false })

  const listings = openListings ?? []
  const listingIds = listings.map((l) => l.id)

  const [analysis, depth, requirementsByListing, pools, { data: applied }] = await Promise.all([
    analyzeGoal(supabase, user.id, listingIds),
    getStudentDepth(supabase, user.id),
    getListingRequirements(supabase, listingIds),
    getApplicantPools(supabase, listingIds),
    supabase.from('applications').select('listing_id').eq('student_id', user.id).neq('status', 'withdrawn'),
  ])

  const appliedTo = new Set((applied ?? []).map((a) => a.listing_id))

  const recommendations = listings
    .filter((l) => !appliedTo.has(l.id))
    .map((l) => {
      const reqs = requirementsByListing.get(l.id) ?? []
      const fit = computeFit(reqs, depth)
      const coverage = gapClosedByListing(reqs, depth)
      return {
        id: l.id,
        title: l.title ?? 'Untitled project',
        posterName: l.poster_display_name,
        tier: assignTier(fit, pools.get(l.id) ?? []),
        matchedShare: coverage.share,
        missingNames: fit.missingSkillIds.map(
          (id) => reqs.find((r) => r.skillId === id)?.canonicalName ?? id,
        ),
        skillNames: reqs.map((r) => r.canonicalName ?? r.skillId),
      }
    })
    // Best fit first — the recommendation is "where can you act today",
    // which is a different question from "what should you go learn".
    .sort((a, b) => b.matchedShare - a.matchedShare)
    .slice(0, 8)

  const data: GoalsData = {
    studentName: student.full_name,
    activeApplicationCount: student.active_application_count ?? 0,
    openListingCount: listings.length,
    derivedFromListings: analysis.derivedFromListings,
    thinData: analysis.thinData,
    gaps: analysis.gaps.slice(0, 10).map((g) => ({
      skillId: g.skillId,
      name: g.canonicalName,
      listingCount: g.listingCount,
    })),
    strengths: analysis.strengths.slice(0, 10).map((s) => ({
      skillId: s.skillId,
      name: s.canonicalName,
      listingCount: s.listingCount,
      depth: s.studentDepth ?? 0,
    })),
    recommendations,
    agentsAvailable: agentsAvailable(),
  }

  return <GoalsClient data={data} />
}
