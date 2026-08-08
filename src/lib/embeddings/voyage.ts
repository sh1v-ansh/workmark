// Thin wrapper around Voyage's embeddings endpoint. No SDK dependency —
// the API is a single REST call, and a hand-rolled fetch is less surface
// area than trusting an unofficial/unverified npm package for something
// this small.
//
// Model: voyage-4, output_dimension 1024 (the family default). If this
// ever changes, skills.embedding's vector(1024) column in schema.sql must
// change with it — the two are not independently adjustable.

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const MODEL = 'voyage-4'
const OUTPUT_DIMENSION = 1024

interface VoyageEmbeddingResponse {
  data: { embedding: number[]; index: number }[]
  model: string
  usage: { total_tokens: number }
}

/**
 * Embeds a batch of strings in one call — Voyage bills per input token
 * regardless of batch size, so batching whenever there's more than one
 * string to embed avoids paying per-request overhead N times over.
 */
export async function embedTexts(texts: string[], inputType?: 'query' | 'document'): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('Missing VOYAGE_API_KEY.')
  if (texts.length === 0) return []

  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      output_dimension: OUTPUT_DIMENSION,
      input_type: inputType,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage embeddings request failed (${res.status}): ${body}`)
  }

  const json = (await res.json()) as VoyageEmbeddingResponse
  // Voyage returns embeddings in input order but with an explicit `index`
  // — sort defensively rather than trusting array order to match input order.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

export async function embedText(text: string, inputType?: 'query' | 'document'): Promise<number[]> {
  const [embedding] = await embedTexts([text], inputType)
  return embedding
}
