// The consent a student gives before we ever touch their GitHub.
//
// This exists because the GitHub install screen doesn't say what we do —
// it says "Workmark wants read access to code and metadata", which is
// technically complete and tells the student nothing. What they actually
// need to know is that we read dependency lists, config files, import
// lines and commit timestamps in order to build a record about them that
// other people will be shown. That is a different question from "may this
// app read my repos", and it deserves its own screen with its own answer.
//
// It is also, plainly, the record. A consumer report built from someone's
// data needs a defensible answer to "when did they agree to this, and to
// what wording" — and that answer has to be a row, not a screenshot of a
// button.

import type { SupabaseClient } from '@supabase/supabase-js'

export const GITHUB_CONSENT_SCOPE = 'github_repository_analysis'

/**
 * Bump this whenever the wording on the consent screen materially changes.
 *
 * Existing consents keep their old version rather than being rewritten, so
 * the row says what the person actually read. A student who agreed to v1 is
 * not treated as having agreed to v2.
 */
export const GITHUB_CONSENT_VERSION = 'github_repository_analysis_v1'

/** Has this student agreed, and not since withdrawn? */
export async function hasGithubConsent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('consents')
    .select('id')
    .eq('student_id', studentId)
    .eq('scope', GITHUB_CONSENT_SCOPE)
    .eq('text_version', GITHUB_CONSENT_VERSION)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle()

  return !!data
}
