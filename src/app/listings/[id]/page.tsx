import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStudentDepth } from '@/lib/matching/depth'
import { getListingRequirements, getApplicantPools } from '@/lib/matching/listing'
import { computeFit, assignTier } from '@/lib/matching/fit'
import ListingDetailClient from './ListingDetailClient'
import { verifiedFacultyPosterIds } from '@/lib/listings/verified-faculty'

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!listing) notFound()

  const requirements = (await getListingRequirements(supabase, [id])).get(id) ?? []

  let studentName: string | null = null
  let fit = null
  let application = null
  let activeApplicationCount = 0

  if (user) {
    const { data: student } = await supabase
      .from('students')
      .select('full_name, active_application_count')
      .eq('id', user.id)
      .maybeSingle()
    studentName = student?.full_name ?? null
    activeApplicationCount = student?.active_application_count ?? 0

    if (student && listing.poster_id !== user.id) {
      const [depth, pools] = await Promise.all([
        getStudentDepth(supabase, user.id),
        getApplicantPools(supabase, [id]),
      ])
      const computed = computeFit(requirements, depth)
      const poolScores = pools.get(id) ?? []
      const tier = assignTier(computed, poolScores)
      const skillNameById = new Map(requirements.map((r) => [r.skillId, r.canonicalName ?? r.skillId]))
      fit = {
        tier,
        rankScore: computed.rankScore,
        confidence: computed.confidence,
        poolSize: poolScores.length,
        perSkill: computed.perSkill.map((s) => ({
          skillId: s.skillId,
          name: skillNameById.get(s.skillId) ?? s.skillId,
          requiredLevel: s.requiredLevel,
          depth: s.depth,
          present: s.present,
        })),
        missingNames: computed.missingSkillIds.map((sid) => skillNameById.get(sid) ?? sid),
      }

      // Impression logging (§ EEOC audit): records that this student was
      // shown this fit tier for this listing. Service-role — the table has
      // no user insert policy, since it's an audit record about the user
      // rather than something they author. Best-effort: a logging failure
      // must not stop someone reading a listing.
      //
      // Still awaited rather than fire-and-forget: this Next version has
      // no after()/waitUntil, so an un-awaited write here could be dropped
      // if the serverless function freezes right after the response is
      // sent — which would silently break an audit trail that matters more
      // than the ~1 insert's worth of latency it costs.
      try {
        const admin = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
        await admin.from('fit_tier_impressions').insert({
          student_id: user.id,
          listing_id: id,
          tier,
          missing_skills: computed.missingSkillIds,
        })
      } catch (err) {
        console.error('[listings/[id]] impression log failed:', err)
      }
    }

    const { data: app } = await supabase
      .from('applications')
      .select('id, status, fit_tier_at_apply, created_at')
      .eq('listing_id', id)
      .eq('student_id', user.id)
      .maybeSingle()
    application = app
  }

  return (
    <ListingDetailClient
      listing={{
        id: listing.id,
        title: listing.title,
        brief: listing.brief,
        posterId: listing.poster_id,
        posterDisplayName: listing.poster_display_name,
        // Confirmed faculty only. A pending claim shows nothing at all —
        // "faculty, unverified" would still say professor, which is the
        // part nobody has checked.
        posterIsVerifiedFaculty: (
          await verifiedFacultyPosterIds(supabase, [listing.poster_id])
        ).has(listing.poster_id),
        status: listing.status,
        estHours: listing.est_hours,
        hoursPerWeek: listing.hours_per_week,
        duration: listing.duration,
        workMode: listing.work_mode,
        teamSize: listing.team_size,
        declaredDifficulty: listing.declared_difficulty,
        createdAt: listing.created_at,
      }}
      requirements={requirements.map((r) => ({ skillId: r.skillId, name: r.canonicalName ?? r.skillId, requiredLevel: r.requiredLevel }))}
      fit={fit}
      application={application}
      isOwner={!!user && listing.poster_id === user.id}
      signedIn={!!user}
      studentName={studentName}
      activeApplicationCount={activeApplicationCount}
    />
  )
}
