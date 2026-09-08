// The whole path, once, against the real database.
//
// Every other test here is pure: rules, arithmetic, shapes. None of them can
// tell you whether a project actually gets from "created" to "skills on
// somebody's record", because that path crosses RLS, four triggers, a GitHub
// scan and a model call — and each of those is exactly where a feature that
// passes its unit tests still does nothing.
//
// SKIPPED BY DEFAULT. It writes to whatever database .env.local points at,
// spends one Anthropic call, and reads a real repository through the GitHub
// App. Run it deliberately:
//
//   WORKMARK_E2E=1 npx vitest run tests/workspace-e2e.test.ts
//
// It cleans up after itself and then checks that it did — the student's
// record is counted before and after, and the test fails if the numbers do
// not match. Everything it creates is either deleted directly or reachable by
// cascade from the workspace row.

import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runVerification } from '@/lib/workspace/run-verification'
import { mintWorkspaceEvidence } from '@/lib/workspace/evidence'
import { resolveTaskVerification } from '@/lib/admin/actions'
import { canReview, outcomeFor } from '@/lib/workspace/review'
import type { MemberRow } from '@/lib/workspace/membership'

/**
 * .env.local, read here rather than through the vitest config.
 *
 * The config is shared with 32 pure test files that must never touch a
 * network, and a setup file that loaded real credentials for all of them
 * would be one accidental `createClient` away from a unit test writing to
 * production. Parsed by hand because the file has spaces around some `=`
 * signs, which `source` chokes on.
 */
function loadEnv(): void {
  let raw: string
  try {
    raw = readFileSync('.env.local', 'utf8')
  } catch {
    return
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key]) continue

    // Surrounding quotes are dotenv syntax, not part of the value. Next's own
    // loader strips them; a hand-rolled parser that does not hands Octokit a
    // PEM beginning with a double quote, which fails to sign a JWT and
    // surfaces three layers away as an unexplained empty repository scan.
    let value = trimmed.slice(eq + 1).trim()
    if (value.length > 1 && ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

const LIVE = process.env.WORKMARK_E2E === '1'
if (LIVE) loadEnv()

/** Who the throwaway project belongs to, and which repo it reads. */
const STUDENT_ID = process.env.E2E_STUDENT_ID ?? ''
const REPO = process.env.E2E_REPO ?? ''
const INSTALLATION = process.env.E2E_INSTALLATION ?? ''
const LOGIN = process.env.E2E_LOGIN ?? ''

const MARKER = '__e2e workspace walkthrough__'

let admin: SupabaseClient
let workspaceId = ''
/** Counted before, checked after. The point of the teardown assertions. */
let before = { evidence: 0, priors: 0, artifacts: 0 }

async function countRecord() {
  const [e, p, a] = await Promise.all([
    admin.from('skill_evidence').select('id', { count: 'exact', head: true }).eq('student_id', STUDENT_ID),
    admin.from('skill_priors').select('id', { count: 'exact', head: true }).eq('student_id', STUDENT_ID),
    admin.from('artifacts').select('id', { count: 'exact', head: true }).eq('student_id', STUDENT_ID),
  ])
  return { evidence: e.count ?? 0, priors: p.count ?? 0, artifacts: a.count ?? 0 }
}

describe.skipIf(!LIVE)('a project, end to end', () => {
  beforeAll(async () => {
    expect(STUDENT_ID && REPO && INSTALLATION && LOGIN,
      'set E2E_STUDENT_ID, E2E_REPO, E2E_INSTALLATION and E2E_LOGIN').toBeTruthy()

    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    before = await countRecord()
  }, 30_000)

  /**
   * Idempotent, so it can run as the last assertion AND as a safety net when
   * an earlier test throws. Nothing here fails if it has already happened.
   */
  async function teardown() {
    if (!admin || !workspaceId) return

    // Artifacts do not cascade from a workspace — workspace_id is ON DELETE
    // SET NULL, deliberately, because evidence is a claim about what somebody
    // did and a deleted project does not undo the work. So the artifact goes
    // first and takes its evidence and audit rows with it.
    const { data: artifacts } = await admin
      .from('artifacts').select('id').eq('workspace_id', workspaceId)
    for (const a of artifacts ?? []) {
      await admin.from('artifacts').delete().eq('id', a.id)
    }

    // Everything else hangs off the workspace.
    await admin.from('workspaces').delete().eq('id', workspaceId)

    // Priors are keyed (student, skill) and belong to no artifact, so a scan
    // leaves them behind. Remove only the ones this run added.
    const after = await countRecord()
    if (after.priors > before.priors) {
      const { data: newest } = await admin
        .from('skill_priors').select('id').eq('student_id', STUDENT_ID)
        .order('extracted_at', { ascending: false }).limit(after.priors - before.priors)
      for (const p of newest ?? []) await admin.from('skill_priors').delete().eq('id', p.id)
    }
  }

  afterAll(teardown, 60_000)

  it('creates a project, links a repo and starts it', async () => {
    const { data: ws, error } = await admin
      .from('workspaces')
      .insert({ title: MARKER, summary: 'End-to-end check. Deleted by the test.', created_by: STUDENT_ID })
      .select('id, status').single()
    expect(error, error?.message).toBeNull()
    workspaceId = ws!.id
    expect(ws!.status).toBe('draft')

    // No membership insert here: workspaces_creator_is_owner already made the
    // owner row. Writing a second one is how the first version of this test
    // hid the bug the next case exists to catch.
    await admin.from('workspace_repos').insert({
      workspace_id: workspaceId, repo_full_name: REPO,
      installation_id: INSTALLATION, granted_by: STUDENT_ID,
    })

    // require_repo_before_starting refuses this without the row above.
    const { error: startErr } = await admin
      .from('workspaces').update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', workspaceId)
    expect(startErr, startErr?.message).toBeNull()
  }, 30_000)

  /**
   * The bug this walkthrough found.
   *
   * v05_0026 says "accepting is the consent" and defaults scan_consent_at
   * from accepted_at — in a BEFORE UPDATE trigger, written for an invitee
   * whose row is updated when they accept. The creator's row is INSERTed with
   * accepted_at already set, so that trigger never fires and their consent is
   * never recorded.
   *
   * Two things then quietly do not happen, and only for the creator: their
   * commits are never attributed to them in work_events, and closing the
   * project puts nothing on their record. On a solo project that is the whole
   * feature producing nothing. Fixed in v05_0037.
   */
  it('records the creator as having consented, by creating', async () => {
    const { data: owner } = await admin
      .from('workspace_members')
      .select('role, accepted_at, scan_consent_at')
      .eq('workspace_id', workspaceId).eq('account_id', STUDENT_ID).single()

    expect(owner!.role).toBe('owner')
    expect(owner!.accepted_at).not.toBeNull()
    expect(
      owner!.scan_consent_at,
      'creator consent is missing — is v05_0037 applied? Without it a solo project '
        + 'produces no attribution and no evidence.',
    ).not.toBeNull()
  }, 30_000)

  it('refuses to start a project with no repository', async () => {
    const { data: ws } = await admin
      .from('workspaces')
      .insert({ title: MARKER + ' (no repo)', created_by: STUDENT_ID })
      .select('id').single()
    const { error } = await admin.from('workspaces').update({ status: 'active' }).eq('id', ws!.id)
    expect(error, 'the database should refuse this').not.toBeNull()
    await admin.from('workspaces').delete().eq('id', ws!.id)
  }, 30_000)

  it('records every board move without being asked to', async () => {
    // If v05_0037 is not applied the case above has already failed loudly.
    // Repaired here so the remaining steps still exercise the path rather
    // than cascading one missing column into five uninformative failures.
    await admin.from('workspace_members')
      .update({ scan_consent_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId).eq('account_id', STUDENT_ID)
      .is('scan_consent_at', null)

    const { data: task } = await admin.from('tasks').insert({
      workspace_id: workspaceId, title: 'Implement the thing', created_by: STUDENT_ID,
      assignee_id: STUDENT_ID, acceptance_criteria: 'It does the thing and there is a test.',
      estimate_hours: 4, difficulty: 5,
    }).select('id').single()

    await admin.from('tasks').update({ status: 'doing' }).eq('id', task!.id)
    await admin.from('tasks').update({ status: 'submitted' }).eq('id', task!.id)

    const { data: moves } = await admin
      .from('task_transitions').select('from_status, to_status').eq('task_id', task!.id)
      .order('occurred_at')

    // Creation, then the two moves. Nothing in this test wrote any of them.
    expect((moves ?? []).map((m) => `${m.from_status ?? '-'}>${m.to_status}`))
      .toEqual(['->backlog', 'backlog>doing', 'doing>submitted'])

    const { data: stamped } = await admin
      .from('tasks').select('started_at, submitted_at').eq('id', task!.id).single()
    expect(stamped!.started_at).not.toBeNull()
    expect(stamped!.submitted_at).not.toBeNull()
  }, 30_000)

  it('settles what it can for free and sends the rest to a person', async () => {
    // A task with no code was never going to leave a trace in a repository.
    const { data: noCode } = await admin.from('tasks').insert({
      workspace_id: workspaceId, title: 'Talk to three users', created_by: STUDENT_ID,
      assignee_id: STUDENT_ID, verifiable: false, status: 'submitted', difficulty: 3,
    }).select('id').single()

    const { data: run } = await admin.from('verification_runs')
      .insert({ workspace_id: workspaceId, triggered_by: STUDENT_ID, trigger: 'manual', status: 'queued' })
      .select('id').single()

    const outcome = await runVerification(admin, run!.id)
    expect(outcome, 'the run should not have been claimed by anything else').not.toBeNull()
    expect(outcome!.checked).toBeGreaterThan(0)

    const { data: verdicts } = await admin
      .from('task_submissions').select('task_id, verdict, checks').eq('workspace_id', workspaceId)

    const noCodeVerdict = (verdicts ?? []).find((v) => v.task_id === noCode!.id)
    expect(noCodeVerdict?.verdict, 'work with no code goes to a person').toBe('unverifiable')

    // The first answer on every submission is logged, by trigger.
    const { data: decisions } = await admin
      .from('task_decisions').select('id').eq('workspace_id', workspaceId)
    expect((decisions ?? []).length).toBeGreaterThanOrEqual(verdicts!.length)
  }, 180_000)

  it('lets a person answer what the checker could not, and keeps both answers', async () => {
    const { data: stuck } = await admin
      .from('task_submissions')
      .select('id, task_id, verdict, human_verdict')
      .eq('workspace_id', workspaceId).eq('verdict', 'unverifiable').limit(1).maybeSingle()
    expect(stuck, 'something should be waiting on a person').not.toBeNull()

    const { data: task } = await admin
      .from('tasks').select('id, status, assignee_id').eq('id', stuck!.task_id).single()

    // The rule, checked against the same function the route and the board use.
    const solo: MemberRow[] = [{
      account_id: STUDENT_ID, role: 'owner',
      accepted_at: new Date().toISOString(), removed_at: null,
    }]
    expect(canReview(solo, STUDENT_ID, {
      id: task!.id, status: task!.status, assigneeId: task!.assignee_id,
      latestVerdict: stuck!.verdict, humanVerdict: stuck!.human_verdict,
    }), 'the assignee must never confirm their own work').toMatch(/you did the work/i)

    // Which is why staff are the backstop on a solo project.
    const result = await resolveTaskVerification(admin, {
      id: stuck!.id, verdict: 'works', adminId: STUDENT_ID, note: 'Checked by hand for the walkthrough.',
    })
    expect(result.ok, result.message).toBe(true)
    expect(outcomeFor('works').taskStatus).toBe('verified')

    const { data: moved } = await admin.from('tasks').select('status').eq('id', task!.id).single()
    expect(moved!.status).toBe('verified')

    // The whole reason task_decisions exists: the checker's original answer
    // is still there after a person overrode it.
    const { data: history } = await admin
      .from('task_decisions').select('verdict, decided_by')
      .eq('submission_id', stuck!.id).order('decided_at')
    expect(history!.map((h) => h.verdict)).toContain('unverifiable')
    expect(history![history!.length - 1].verdict).toBe('human_verified')
    expect(history![history!.length - 1].decided_by).toBe('person')
  }, 60_000)

  it('puts verified work on the record when the project closes', async () => {
    await admin.from('workspaces')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', workspaceId)

    const result = await mintWorkspaceEvidence(admin, workspaceId)
    expect(result.repoFullName).toBe(REPO)

    const mine = result.members.find((m) => m.accountId === STUDENT_ID)
    expect(mine, 'the owner should have been considered').toBeDefined()
    expect(mine!.skipped, `skipped: ${mine!.skipped}`).toBeNull()
    expect(mine!.error, mine!.error ?? '').toBeNull()

    const { data: artifact } = await admin
      .from('artifacts').select('id, tier, workspace_id')
      .eq('workspace_id', workspaceId).maybeSingle()
    expect(artifact, 'a project artifact should exist').not.toBeNull()
    expect(artifact!.tier).toBe('workspace_verified')

    const { data: evidence } = await admin
      .from('skill_evidence').select('id, skill_id, base, source_agreement, workspace_id, difficulty_cleared')
      .eq('artifact_id', artifact!.id)

    expect((evidence ?? []).length, 'the scan should have produced evidence').toBeGreaterThan(0)
    for (const row of evidence!) {
      expect(Number(row.base)).toBe(0.6)
      expect(row.source_agreement).toBe(2)
      expect(row.workspace_id).toBe(workspaceId)
      expect(row.difficulty_cleared).toBeGreaterThanOrEqual(1)
      expect(row.difficulty_cleared).toBeLessThanOrEqual(5)
    }

    // The trail a dispute reads. Without this, project evidence carries the
    // same audit row as a plain scan and says nothing about the tasks.
    const { data: audit } = await admin
      .from('evidence_audit').select('source, raw_input')
      .in('evidence_id', evidence!.map((e) => e.id as string))

    // Two rows per evidence, and both belong: processRepo records how the
    // number was computed, and the close records what it rested on. Different
    // questions, and a dispute asks the second one.
    const basis = (audit ?? []).filter((r) => r.source === 'workspace_close')
    expect(basis.length, 'every evidence row needs a project basis').toBe(evidence!.length)
    expect((audit ?? []).length, 'the scan derivation is kept too')
      .toBeGreaterThan(basis.length)

    for (const row of basis) {
      const input = row.raw_input as Record<string, unknown>
      expect(input.workspace_id).toBe(workspaceId)
      expect(Number(input.verified_tasks)).toBeGreaterThan(0)
      expect(Array.isArray(input.tasks), 'the tasks themselves, not just a count').toBe(true)
    }

    const { data: signal } = await admin
      .from('artifact_signals').select('value')
      .eq('artifact_id', artifact!.id).eq('signal_name', 'workspace_verified_tasks').maybeSingle()
    expect(signal?.value, 'the student should be told what earned the tier').toMatch(/verified against criteria/)
  }, 300_000)

  // Last, and an assertion rather than a hope. A test that writes to somebody
  // real's consumer record and only *intends* to clean up is a test that
  // eventually leaves something behind.
  it('leaves the record exactly as it found it', async () => {
    await teardown()
    const after = await countRecord()
    expect(after, 'the walkthrough must not change the record it borrowed').toEqual(before)

    const { data: leftover } = await admin
      .from('workspaces').select('id').eq('id', workspaceId).maybeSingle()
    expect(leftover, 'the throwaway project should be gone').toBeNull()
  }, 60_000)
})
