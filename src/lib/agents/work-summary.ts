// Helping someone describe the work they actually did.
//
// When an engagement closes, both sides have to agree on a description of
// what was built. That description is not decoration: it is what a future
// reader sees attached to this piece of the student's record, long after
// everyone has forgotten the details.
//
// It was also the one place in the product with a blank textarea and no
// help, which is why engagements sit unclosed. People are bad at describing
// their own work — they either write "did the backend" or they write four
// paragraphs of narrative. This turns a few rough notes into the shape a
// reader needs.
//
// It suggests, like every other agent here. The draft lands in the textarea
// for the student to edit, and it still takes both sides agreeing before it
// is saved. Nothing here writes to the engagement, and nothing here touches
// skill_evidence — the evidence comes from scanning the repository, on the
// same path as any other project.

import type { SupabaseClient } from '@supabase/supabase-js'
import { callStructuredAgent } from './client'
import { untrusted } from './untrusted'

export interface WorkSummaryDraft {
  description: string
}

const SYSTEM = `You help a computer science student describe work they completed on a project, so both they and the person who posted the project can agree on an accurate record of it.

This description becomes a permanent part of the student's record on Workmark. Someone reading it in two years, deciding whether to work with this person, should be able to tell what was actually built and what the student was responsible for.

Write it:
- In first person, plainly, the way the student would describe it to a colleague.
- Concrete about what was built: the thing itself, the part they owned, and what state it was left in.
- Short. One paragraph, occasionally two. This is a record entry, not a case study.

Never do these:
- Do not invent anything. If the notes do not say what technology was used, do not name one. If they do not say the project shipped, do not say it shipped. A vague description is fine; a confident wrong one is not, because the other side has to agree to it and will not agree to something untrue.
- Do not praise the student or characterise the quality of the work. "I built X" — not "I successfully delivered a robust X". The record says what happened; it is not a reference letter.
- Do not pad with the project's background or purpose beyond a clause of context. What the student did is the point.

If the notes are too thin to describe the work at all, say so in the description field — write one sentence explaining what else you would need to know. Do not guess to fill the space.`

const SCHEMA = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'The work description, first person, one or two short paragraphs.',
    },
  },
  required: ['description'],
  additionalProperties: false,
}

interface AgentResponse {
  description?: string
}

/**
 * Draft a description of completed work from the student's own notes.
 *
 * The listing title and brief are included as context so the draft can name
 * the project correctly, but the system prompt is explicit that the notes
 * are the source of truth — otherwise the model happily describes the
 * listing rather than what the student did, which reads plausible and is
 * exactly the failure that would get baked into someone's permanent record.
 */
export async function draftWorkSummary(
  supabase: SupabaseClient,
  studentId: string,
  args: { notes: string; listingTitle: string | null; listingBrief: string | null },
): Promise<WorkSummaryDraft | null> {
  const userContent = [
    'THE PROJECT THIS WORK WAS PART OF (context only — do not describe this, describe the notes below)',
    untrusted('project_title', args.listingTitle),
    untrusted('project_brief', args.listingBrief),
    '',
    'THE STUDENT\'S OWN NOTES ON WHAT THEY DID (this is what you are describing)',
    untrusted('student_notes', args.notes),
  ].join('\n')

  const result = await callStructuredAgent<AgentResponse>(supabase, {
    agentType: 'work_summary',
    studentId,
    system: SYSTEM,
    userContent,
    schema: SCHEMA as unknown as Record<string, unknown>,
    inputForAudit: { notes: args.notes, listing_title: args.listingTitle },
  })

  if (!result?.description) return null
  return { description: result.description }
}
