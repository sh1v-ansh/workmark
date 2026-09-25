import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EMPTY_ELIGIBILITY } from '@/lib/profile/eligibility'
import EligibilitySection from '@/app/account/settings/EligibilitySection'
import Card from '@/components/Card'
import { C, F } from '@/lib/theme/dark-tokens'

export const metadata = { title: 'Opportunities for you' }

/**
 * /me/opportunities: the private questions that decide which
 * group-specific programs a student is shown. Its own page, reached from
 * the account menu and the dashboard nudge, so it is never on a page
 * anyone else can see.
 */
export default async function OpportunitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: student }, { data: row }] = await Promise.all([
    supabase.from('students').select('id').eq('id', user.id).maybeSingle(),
    // Owner-only table; this is the student reading their own answers.
    supabase
      .from('student_eligibility')
      .select('use_for_opportunities, first_gen, military, gender, gender_self, race_ethnicity, disability, lgbtq, low_income, us_state, transfer, citizenship')
      .eq('student_id', user.id)
      .maybeSingle(),
  ])
  if (!student) redirect('/onboarding')
  const eligibility = row ? { ...EMPTY_ELIGIBILITY, ...row, race_ethnicity: row.race_ethnicity ?? [] } : EMPTY_ELIGIBILITY

  return (
    <div className="wm-app-ground" style={{ minHeight: '100vh', background: C.bg }}>
      <main id="main-content" style={{ maxWidth: 720, margin: '0 auto', padding: '34px 24px 96px' }}>
        <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, letterSpacing: '-0.022em', color: C.text, marginBottom: 8 }}>
          Opportunities for you
        </h1>
        <p style={{ fontSize: 15.5, color: C.textMuted, lineHeight: 1.6, marginBottom: 8, maxWidth: '62ch' }}>
          Some scholarships, programs and internships are only open to certain groups. Tell us if any
          apply and we&apos;ll show you the ones you qualify for.
        </p>
        <p style={{ fontSize: 14.5, color: C.textFaint, lineHeight: 1.6, marginBottom: 24, maxWidth: '62ch' }}>
          Only you can see this. It is never shown to employers and never affects how your work is
          judged. Every question is optional.
        </p>
        <Card hoverable={false} padding="22px 24px">
          <EligibilitySection initial={eligibility} />
        </Card>
      </main>
    </div>
  )
}
