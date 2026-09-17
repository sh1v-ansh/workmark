// Showing the result before the server has agreed to it.
//
// ── The problem this solves ───────────────────────────────────────────────
// Every write on the board currently waits for a round trip before anything
// moves: add a subtask and the dialog sits there, drag a card and it hangs in
// the old column, answer a checkpoint and nothing happens for a beat. None of
// those are slow by server standards — they are 200 to 600ms — and all of
// them feel broken, because the thing you just did did not happen.
//
// The fix is not a faster server. It is showing the outcome immediately and
// reconciling afterwards, which is what every application that feels good
// does. The work is in reconciling honestly.
//
// ── Why an overlay rather than editing a copy of the data ─────────────────
// The board's data comes from the server on every render. Copying it into
// state and mutating the copy means two sources of truth and a merge problem
// on every refresh — the bug where somebody's teammate's change disappears
// because the local copy was written last.
//
// An overlay is a small set of pending changes applied on top of server data
// at render time. The server stays the only source of truth; the overlay is a
// short-lived claim about what it is about to say. When the refresh lands the
// overlay is dropped and the truth shows through, whether or not it matches.
//
// ── Why failures roll back loudly ─────────────────────────────────────────
// A silent rollback is worse than a slow write. Somebody who watched a card
// move and then move back, with no explanation, concludes the board is
// unreliable — which is a much more expensive belief than a half-second wait.
// So every rollback is paired with a message saying what did not happen.

export interface Overlay<T> {
  /** Items that do not exist on the server yet, newest last. */
  added: T[]
  /** Field changes to existing items, by id. */
  patched: Record<string, Partial<T>>
  /** Ids to hide. */
  removed: string[]
}

export function emptyOverlay<T>(): Overlay<T> {
  return { added: [], patched: {}, removed: [] }
}

export function isEmpty<T>(overlay: Overlay<T>): boolean {
  return overlay.added.length === 0
    && overlay.removed.length === 0
    && Object.keys(overlay.patched).length === 0
}

/**
 * Server data with the pending changes shown on top.
 *
 * Order matters: patch, then drop removals, then append additions. Appending
 * first would let a patch apply to an item that is about to be hidden, which
 * is wasted work and one more state to reason about.
 */
export function apply<T extends { id: string }>(items: T[], overlay: Overlay<T>): T[] {
  const removed = new Set(overlay.removed)

  const existing = items
    .map((item) => {
      const patch = overlay.patched[item.id]
      return patch ? { ...item, ...patch } : item
    })
    .filter((item) => !removed.has(item.id))

  // An addition whose real row has already arrived is dropped rather than
  // shown twice. This is what makes it safe to keep the overlay until the
  // refresh has actually landed: if it lands early, the duplicate never
  // appears.
  const known = new Set(items.map((i) => i.id))
  const added = overlay.added.filter((a) => !known.has(a.id) && !removed.has(a.id))

  return [...existing, ...added]
}

/**
 * A stand-in id for something the server has not named yet.
 *
 * Prefixed so it is recognisable in a debugger and so nothing mistakes it for
 * a real uuid — a temporary id that reaches an API call is a 400 at best and
 * a write against the wrong row at worst.
 */
export function tempId(): string {
  return `pending-${Math.random().toString(36).slice(2, 10)}`
}

export function isTempId(id: string): boolean {
  return id.startsWith('pending-')
}

// ── The individual operations ─────────────────────────────────────────────
// Each returns a new overlay rather than mutating, so they compose and so a
// stale closure cannot write over a newer change.

export function withAdded<T>(overlay: Overlay<T>, item: T): Overlay<T> {
  return { ...overlay, added: [...overlay.added, item] }
}

export function withPatched<T>(
  overlay: Overlay<T>,
  id: string,
  patch: Partial<T>,
): Overlay<T> {
  return {
    ...overlay,
    // Merged rather than replaced: two quick edits to one card — move it, then
    // block it — must both survive, and the second arriving first must not
    // erase the first.
    patched: { ...overlay.patched, [id]: { ...(overlay.patched[id] ?? {}), ...patch } },
  }
}

export function withRemoved<T>(overlay: Overlay<T>, id: string): Overlay<T> {
  return { ...overlay, removed: [...overlay.removed, id] }
}

/**
 * Undo one claim, leaving the others alone.
 *
 * Used when a single write fails while others are still in flight. Dropping
 * the whole overlay would roll back changes that are perfectly fine, which is
 * how one failed request becomes three cards jumping.
 */
export function without<T extends { id: string }>(overlay: Overlay<T>, id: string): Overlay<T> {
  const { [id]: _dropped, ...patched } = overlay.patched
  return {
    added: overlay.added.filter((a) => a.id !== id),
    patched,
    removed: overlay.removed.filter((r) => r !== id),
  }
}
