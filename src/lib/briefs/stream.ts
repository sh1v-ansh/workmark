/**
 * Read a streamed brief from /api/agents/brief.
 *
 * The body is the markdown as it is written, then a \u001e separator and one
 * JSON record: { ok, id } once saved, or { error }. A non-2xx response is an
 * ordinary JSON error sent before any streaming started.
 */
export async function readBriefStream(
  res: Response,
  onText: (textSoFar: string) => void,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({}))
    return { ok: false, error: (json as { error?: string }).error ?? 'Could not generate a project idea.' }
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let all = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    all += decoder.decode(value, { stream: true })
    const cut = all.indexOf('\u001e')
    onText(cut >= 0 ? all.slice(0, cut) : all)
  }
  const cut = all.indexOf('\u001e')
  const tail = cut >= 0 ? all.slice(cut + 1) : ''
  try {
    const record = JSON.parse(tail) as { ok?: boolean; id?: string; error?: string }
    if (record.ok && record.id) return { ok: true, id: record.id }
    return { ok: false, error: record.error ?? 'Could not generate a project idea.' }
  } catch {
    return { ok: false, error: 'The connection dropped before the idea was saved. Try again.' }
  }
}
