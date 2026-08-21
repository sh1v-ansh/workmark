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

/** A step that fails this many times is abandoned rather than retried forever. */
const MAX_ATTEMPTS_PER_JOB = 40

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
 * Where this deployment can reach itself. VERCEL_URL is per-deployment and
 * always correct on Vercel; NEXT_PUBLIC_SITE_URL is the configured public
 * origin and is what a self-hosted or local run has.
 */
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
