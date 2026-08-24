import type { Person } from '../types'

export type SiblingKind = 'full' | 'half'

export function getSiblings(
  person: Person,
  people: Record<string, Person>
): Array<{ person: Person; kind: SiblingKind }> {
  if (!person.motherId && !person.fatherId) return []

  const result: Array<{ person: Person; kind: SiblingKind }> = []
  for (const other of Object.values(people)) {
    if (other.id === person.id) continue
    const sharesMother = Boolean(person.motherId) && other.motherId === person.motherId
    const sharesFather = Boolean(person.fatherId) && other.fatherId === person.fatherId
    if (sharesMother && sharesFather) {
      result.push({ person: other, kind: 'full' })
    } else if (sharesMother || sharesFather) {
      result.push({ person: other, kind: 'half' })
    }
  }
  return result
}

export function getChildren(person: Person, people: Record<string, Person>): Person[] {
  return Object.values(people).filter(
    (p) => p.motherId === person.id || p.fatherId === person.id
  )
}

export function getSpouses(person: Person, people: Record<string, Person>): Person[] {
  return person.spouseIds
    .map((id) => people[id])
    .filter((p): p is Person => Boolean(p))
}

export function getParents(person: Person, people: Record<string, Person>): Person[] {
  const parents: Person[] = []
  if (person.motherId && people[person.motherId]) parents.push(people[person.motherId])
  if (person.fatherId && people[person.fatherId]) parents.push(people[person.fatherId])
  return parents
}

// Depth (generation level) = max(parents' depth) + 1. Root ancestors (no parents) start at 0.
// Spouses are pulled to the same depth as their partner so couples sit on one row.
export function computeDepths(people: Record<string, Person>): Record<string, number> {
  const depths: Record<string, number> = {}
  const ids = Object.keys(people)
  const visiting = new Set<string>()

  function depthOf(id: string): number {
    if (depths[id] !== undefined) return depths[id]
    if (visiting.has(id)) return 0 // cycle guard
    visiting.add(id)
    const person = people[id]
    const parentIds = [person.motherId, person.fatherId].filter(
      (pid): pid is string => Boolean(pid) && Boolean(people[pid as string])
    )
    let depth = 0
    if (parentIds.length > 0) {
      depth = Math.max(...parentIds.map((pid) => depthOf(pid))) + 1
    }
    visiting.delete(id)
    depths[id] = depth
    return depth
  }

  for (const id of ids) depthOf(id)

  // Shifting one spouse to match the other must drag their WHOLE ancestor chain
  // along by the same amount — otherwise a shallowly-recorded side (fewer known
  // generations) ends up with its parents on a different row than the other
  // spouse's parents, even though marriage should keep both families' rows
  // aligned generation-by-generation.
  function shiftAncestorsBy(id: string, delta: number, seen: Set<string>) {
    if (seen.has(id)) return
    seen.add(id)
    depths[id] += delta
    const person = people[id]
    if (person.motherId && people[person.motherId]) shiftAncestorsBy(person.motherId, delta, seen)
    if (person.fatherId && people[person.fatherId]) shiftAncestorsBy(person.fatherId, delta, seen)
  }

  // Repeatedly align spouse pairs until a full pass makes no more changes —
  // shifting one couple's ancestors can reveal a new mismatch further up a
  // remarriage chain, so this needs to reach a fixed point, not just one pass.
  let changed = true
  let safety = 0
  while (changed && safety < 200) {
    changed = false
    safety += 1
    for (const id of ids) {
      const person = people[id]
      for (const spouseId of person.spouseIds) {
        if (!people[spouseId]) continue
        const a = depths[id]
        const b = depths[spouseId]
        if (a === b) continue
        changed = true
        if (a < b) shiftAncestorsBy(id, b - a, new Set())
        else shiftAncestorsBy(spouseId, a - b, new Set())
      }
    }
  }

  return depths
}
