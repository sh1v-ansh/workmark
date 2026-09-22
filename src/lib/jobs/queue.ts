// The job queue's data layer: create a job, claim it for one step, record
// the result of that step, and kick the worker.
//
// Deliberately built on the database we already have rather than a queue
// service. The work is low-volume (a scan per student, occasionally), the
// steps are idempotent, and Postgres gives us the one thing that actually
// matters here — an atomic claim — through claim_job(). Adding a broker
// would be more moving parts for no property we don't already get.

import type { SupabaseClient } from '@supabase/supabase-js'

export type JobKind = 'github_scan'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type StepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface JobStep {
  /** Stable identifier for the unit of work — a repo grant id, say. */
  id: string
  /** What to show the user while this step runs. */
  label: string
  status: StepStatus
  /** Populated on done/failed: a one-line outcome the user can read. */
  detail?: string | null
  /**
   * How many times this step has been picked up.
   *
   * Counted per step, not per job. A step killed by the platform mid-run
   * never reaches completeStep, so it stays pending, and the sweeper hands
   * the same step back on the next pass — forever, until the job-level cap
   * of 40 is reached. One slow repository could therefore burn forty full
   * scans at full API cost while the other repositories never ran at all,
   * because the doomed step is always the next pending one.
   */
  attempts?: number
}

export interface Job {
  id: string
  student_id: string
  kind: JobKind
  status: JobStatus
  steps: JobStep[]
  total_steps: number
  completed_steps: number
  result: Record<string, unknown> | null
  error: string | null
  locked_at: string | null
  attempts: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  updated_at: string
}

/** A job that keeps failing is abandoned rather than retried forever. */
const MAX_ATTEMPTS_PER_JOB = 40

/**
 * How many times one step may be started before it is given up on.
 *
 * Three, because the two reasons a step gets restarted are a lost chain
 * (worth one retry) and a step too slow to finish inside the function's
 * sixty seconds (worth one more, in case the first was a cold start). A
 * fourth attempt has never succeeded where three failed, and each one costs
 * a full repository scan.
 */
const MAX_ATTEMPTS_PER_STEP = 3

export async function createJob(
  admin: SupabaseClient,
  studentId: string,
  kind: JobKind,
  steps: JobStep[],
): Promise<Job> {
  const { data, error } = await admin
    .from('jobs')
    .insert({
      student_id: studentId,
      kind,
      steps,
      total_steps: steps.length,
      status: steps.length === 0 ? 'succeeded' : 'queued',
      finished_at: steps.length === 0 ? new Date().toISOString() : null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Job
}

/** The job this student already has in flight for this kind, if any. */
export async function findActiveJob(
  admin: SupabaseClient,
  studentId: string,
  kind: JobKind,
): Promise<Job | null> {
  const { data } = await admin
    .from('jobs')
    .select('*')
    .eq('student_id', studentId)
    .eq('kind', kind)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Job) ?? null
}

/**
 * Take the lease. Returns null when another worker already holds it — which
 * is expected, not exceptional: the self-chained call and the cron sweeper
 * both aim at the same job on purpose, so that a dropped chain gets picked
 * up. Exactly one of them should win, and the loser should quietly stop.
 */
export async function claimJob(admin: SupabaseClient, jobId: string): Promise<Job | null> {
  const { data, error } = await admin.rpc('claim_job', { p_job_id: jobId })
  if (error) throw error
  const rows = (data ?? []) as Job[]
  return rows[0] ?? null
}

/** Release the lease without advancing — used when a step is abandoned. */
export async function releaseJob(admin: SupabaseClient, jobId: string): Promise<void> {
  await admin.from('jobs').update({ locked_at: null, updated_at: new Date().toISOString() }).eq('id', jobId)
}

/**
 * Record the outcome of one step and decide what happens next.
 *
 * A failed step does NOT fail the job: one unreadable repo shouldn't cost a
 * student the other six. It is marked failed with its reason, counted as
 * completed, and the job carries on — the summary reports how many failed
 * so the failure stays visible rather than being silently swallowed.
 */
export async function completeStep(
  admin: SupabaseClient,
  job: Job,
  stepId: string,
  outcome: { ok: boolean; detail: string },
): Promise<{ done: boolean }> {
  const steps = job.steps.map((s): JobStep =>
    s.id === stepId ? { ...s, status: outcome.ok ? 'done' : 'failed', detail: outcome.detail } : s,
  )
  const completed = steps.filter((s) => s.status === 'done' || s.status === 'failed').length
  const remaining = steps.some((s) => s.status === 'pending' || s.status === 'running')
  const exhausted = job.attempts >= MAX_ATTEMPTS_PER_JOB
  const done = !remaining || exhausted

  const failedCount = steps.filter((s) => s.status === 'failed').length
  const patch: Record<string, unknown> = {
    steps,
    completed_steps: completed,
    locked_at: null,
    updated_at: new Date().toISOString(),
  }

  if (done) {
    patch.status = failedCount === steps.length ? 'failed' : 'succeeded'
    patch.finished_at = new Date().toISOString()
    patch.result = { total: steps.length, failed: failedCount }
    if (exhausted && remaining) {
      patch.error = 'Stopped after too many attempts — some steps did not finish.'
    }
  }

  const { error } = await admin.from('jobs').update(patch).eq('id', job.id)
  if (error) throw error
  return { done }
}

export async function failJob(admin: SupabaseClient, jobId: string, message: string): Promise<void> {
  await admin.from('jobs').update({
    status: 'failed',
    error: message,
    locked_at: null,
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', jobId)
}

/** Mark the next pending step as running, so the UI can name it. */
export function nextPendingStep(job: Job): JobStep | null {
  return job.steps.find((s) => s.status === 'pending' || s.status === 'running') ?? null
}

/**
 * Take the next step, counting the attempt — or give up on it.
 *
 * Returns the step to run, or null when there is nothing left. A step that
 * has already been started MAX_ATTEMPTS_PER_STEP times is marked failed and
 * the search moves on, which is the difference between "one repository could
 * not be read" and "the scan stopped after this repository and never reached
 * the other twenty-four".
 *
 * The write happens before the work, so an attempt is counted even when the
 * function is killed mid-step — which is precisely the case this exists for
 * and the one a write-afterwards would miss.
 */
export async function claimStep(
  admin: SupabaseClient,
  job: Job,
): Promise<{ step: JobStep | null; steps: JobStep[] }> {
  const steps = job.steps.map((s) => ({ ...s }))

  for (const step of steps) {
    if (step.status !== 'pending' && step.status !== 'running') continue

    const attempts = (step.attempts ?? 0) + 1
    if (attempts > MAX_ATTEMPTS_PER_STEP) {
      step.status = 'failed'
      step.detail = 'Gave up after three attempts — this one kept timing out.'
      continue
    }

    step.status = 'running'
    step.attempts = attempts
    await admin.from('jobs')
      .update({ steps, updated_at: new Date().toISOString() })
      .eq('id', job.id)
    return { step, steps }
  }

  // Nothing runnable left. Persist any steps just abandoned, so the counts
  // the UI reads match what actually happened.
  await admin.from('jobs')
    .update({ steps, updated_at: new Date().toISOString() })
    .eq('id', job.id)
  return { step: null, steps }
}

/**
 * Where this deployment can reach itself. VERCEL_URL is per-deployment and
 * always correct on Vercel; NEXT_PUBLIC_SITE_URL is the configured public
 * origin and is what a self-hosted or local run has.
 */
/**
 * Whether a job created right now could actually be run.
 *
 * The enqueue route used to create the job and report success even when it
 * knew the worker was unreachable — the kick failed, logged to a server
 * console nobody reads, and the student watched 0/25 forever. A job nothing
 * can drive should never be created in the first place.
 */
export function workerReachable(): { ok: true } | { ok: false; reason: string } {
  if (!process.env.CRON_SECRET) {
    return { ok: false, reason: 'CRON_SECRET is not set on this deployment.' }
  }
  if (!selfOrigin()) {
    return { ok: false, reason: 'Neither VERCEL_URL nor NEXT_PUBLIC_SITE_URL is set.' }
  }
  return { ok: true }
}

/**
 * Stop a job and throw away what's left.
 *
 * Steps already finished keep their evidence — that work really happened and
 * deleting it would be a lie about the past. What cancelling discards is the
 * remaining plan.
 */
export async function cancelJob(
  admin: SupabaseClient,
  jobId: string,
  studentId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('jobs')
    .update({
      status: 'cancelled',
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      locked_at: null,
    })
    .eq('id', jobId)
    // Scoped to the owner: a job id is a uuid, but "hard to guess" is not
    // an access rule.
    .eq('student_id', studentId)
    .in('status', ['queued', 'running'])
    .select('id')
  return !!data && data.length > 0
}

export function selfOrigin(): string | null {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.NEXT_PUBLIC_SITE_URL ?? null
}

/**
 * Ask a worker to run the next step, without waiting for it.
 *
 * Fire-and-forget on purpose: the caller's job is to return to the user
 * immediately. If this request never lands — cold start, network blip, the
 * function being torn down — the cron sweeper picks the job up within the
 * minute. That redundancy is why it is safe not to await.
 */
export function kickJob(jobId: string): void {
  const origin = selfOrigin()
  const secret = process.env.CRON_SECRET
  if (!origin || !secret) {
    // Without both, the chain can't run and the job waits for cron (which
    // also needs the secret). Log loudly: this is a deploy misconfiguration,
    // and the symptom — jobs that never start — is otherwise baffling.
    console.error('[jobs] cannot kick worker: CRON_SECRET and/or an origin (VERCEL_URL / NEXT_PUBLIC_SITE_URL) are not set')
    return
  }
  void fetch(`${origin}/api/jobs/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ jobId }),
  }).catch((err) => console.error('[jobs] kick failed, leaving it to cron:', err))
}
