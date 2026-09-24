import { readTextStream } from '@/lib/http/text-stream'

/** Read a streamed brief from /api/agents/brief. See lib/http/text-stream. */
export async function readBriefStream(
  res: Response,
  onText: (textSoFar: string) => void,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const record = await readTextStream<{ ok?: boolean; id?: string }>(res, onText)
  if (record.ok && record.id) return { ok: true, id: record.id }
  return { ok: false, error: record.error ?? 'Could not generate a project idea.' }
}
