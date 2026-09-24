/**
 * Streamed text responses, shared by every route whose AI output a person
 * reads as it arrives (project ideas, the tech lead's replies, the week's
 * kickoff and retro).
 *
 * The body is the text as it is written, then one \u001e separator and a
 * single JSON record with whatever the route has to say once it is done:
 * saved ids, a suggested subtask, or { error }.
 */
export function textStreamResponse(
  run: (emit: (text: string) => void) => Promise<Record<string, unknown>>,
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let record: Record<string, unknown>
      try {
        record = await run((text) => controller.enqueue(encoder.encode(text.replace(/\u001e/g, ''))))
      } catch (err) {
        console.error('[text-stream] failed:', err)
        record = { error: 'Something went wrong. Please try again.' }
      }
      controller.enqueue(encoder.encode(`\u001e${JSON.stringify(record)}`))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/**
 * Read one on the client. onText gets the whole text so far on every chunk.
 * A JSON response (a route that answered before streaming, or refused) is
 * returned as its record, with `error` set when it was not ok.
 */
export async function readTextStream<T extends Record<string, unknown>>(
  res: Response,
  onText: (textSoFar: string) => void,
): Promise<T & { error?: string }> {
  const type = res.headers.get('content-type') ?? ''
  if (!type.startsWith('text/plain') || !res.body) {
    const json = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok && !json.error) return { ...json, error: 'Something went wrong.' }
    return json
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
  try {
    return JSON.parse(cut >= 0 ? all.slice(cut + 1) : '') as T & { error?: string }
  } catch {
    return { error: 'The connection dropped before it finished. Try again.' } as T & { error?: string }
  }
}
