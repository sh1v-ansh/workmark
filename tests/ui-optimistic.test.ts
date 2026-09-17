import { describe, it, expect } from 'vitest'
import {
  emptyOverlay, isEmpty, apply, withAdded, withPatched, withRemoved, without,
  tempId, isTempId,
} from '../src/lib/ui/optimistic'

interface Card { id: string; title: string; status: string }
const card = (id: string, extra: Partial<Card> = {}): Card =>
  ({ id, title: `Card ${id}`, status: 'planned', ...extra })

describe('apply', () => {
  const server = [card('a'), card('b')]

  it('shows server data untouched when nothing is pending', () => {
    expect(apply(server, emptyOverlay<Card>())).toEqual(server)
  })

  it('shows a patch immediately', () => {
    const o = withPatched(emptyOverlay<Card>(), 'a', { status: 'doing' })
    expect(apply(server, o).find((c) => c.id === 'a')?.status).toBe('doing')
  })

  it('hides a removal immediately', () => {
    expect(apply(server, withRemoved(emptyOverlay<Card>(), 'a')).map((c) => c.id)).toEqual(['b'])
  })

  it('appends something the server has not got yet', () => {
    const o = withAdded(emptyOverlay<Card>(), card('new'))
    expect(apply(server, o).map((c) => c.id)).toEqual(['a', 'b', 'new'])
  })

  // The case that makes it safe to hold the overlay until the refresh lands:
  // if the real row arrives first, the pending copy must not double up.
  it('drops a pending addition once the real row arrives', () => {
    const o = withAdded(emptyOverlay<Card>(), card('c'))
    expect(apply([...server, card('c')], o).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('does not patch something that is also being removed', () => {
    let o = withPatched(emptyOverlay<Card>(), 'a', { status: 'doing' })
    o = withRemoved(o, 'a')
    expect(apply(server, o).map((c) => c.id)).toEqual(['b'])
  })
})

describe('withPatched', () => {
  // Two quick edits to one card — move it, then block it — must both survive.
  it('merges rather than replacing', () => {
    let o = withPatched(emptyOverlay<Card>(), 'a', { status: 'doing' })
    o = withPatched(o, 'a', { title: 'Renamed' })
    expect(o.patched.a).toEqual({ status: 'doing', title: 'Renamed' })
  })

  it('keeps other cards out of it', () => {
    let o = withPatched(emptyOverlay<Card>(), 'a', { status: 'doing' })
    o = withPatched(o, 'b', { status: 'submitted' })
    expect(o.patched.a).toEqual({ status: 'doing' })
  })
})

describe('without', () => {
  // One failed request must not roll back two good ones.
  it('undoes one claim and leaves the rest', () => {
    let o = withPatched(emptyOverlay<Card>(), 'a', { status: 'doing' })
    o = withPatched(o, 'b', { status: 'submitted' })
    o = withAdded(o, card('new'))

    const rolled = without(o, 'a')
    expect(rolled.patched).toEqual({ b: { status: 'submitted' } })
    expect(rolled.added.map((c) => c.id)).toEqual(['new'])
  })

  it('removes a failed addition', () => {
    const o = withAdded(emptyOverlay<Card>(), card('new'))
    expect(without(o, 'new').added).toEqual([])
  })

  it('is harmless for an id that is not pending', () => {
    const o = withPatched(emptyOverlay<Card>(), 'a', { status: 'doing' })
    expect(without(o, 'zzz')).toEqual(o)
  })
})

describe('isEmpty', () => {
  it('is true for a fresh overlay and false once anything is claimed', () => {
    expect(isEmpty(emptyOverlay<Card>())).toBe(true)
    expect(isEmpty(withRemoved(emptyOverlay<Card>(), 'a'))).toBe(false)
  })
})

describe('tempId', () => {
  // A temporary id reaching an API call is a 400 at best and a write against
  // the wrong row at worst, so it has to be recognisable.
  it('is recognisable and never looks like a uuid', () => {
    const id = tempId()
    expect(isTempId(id)).toBe(true)
    expect(id).not.toMatch(/^[0-9a-f]{8}-/)
  })

  it('does not collide across a burst', () => {
    const ids = new Set(Array.from({ length: 500 }, tempId))
    expect(ids.size).toBe(500)
  })

  it('does not mistake a real id for a pending one', () => {
    expect(isTempId('3f2b8c1a-0000-4000-8000-000000000000')).toBe(false)
  })
})
