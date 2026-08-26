import type { Person } from '../types'
import { computeDepths } from './family'

export interface LayoutNode {
  id: string
  x: number
  y: number
  depth: number
}

export interface LayoutEdge {
  kind: 'parent-child' | 'spouse'
  from: string
  to: string
}

export interface Layout {
  nodes: Record<string, LayoutNode>
  edges: LayoutEdge[]
  rowHeight: number
  colWidth: number
}

export const ROW_HEIGHT = 160
export const COL_WIDTH = 140

// Chronological Y axis: pixels per calendar year, and the assumed length of
// a generation (used to place people with no known birthDate) so both scales
// line up instead of one group drifting relative to the other.
const YEAR_PX = 10
const GENERATION_YEARS = 27

// X-ordering/spacing still works on discrete bands rather than raw pixels —
// a real linear Y axis has no natural "row" boundary, but the barycenter
// ordering and collision-avoidance below need *some* grouping granularity.
// A decade is coarse enough to keep siblings (usually born within a decade
// of each other) banded together, fine enough to keep real generations apart.
const BAND_YEARS = 10

function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return Number.isNaN(d.getTime()) ? null : d.getFullYear()
}

// A year for every person — their own birthDate when known, otherwise
// estimated from their generation depth relative to whichever depths *do*
// have known birthdates nearby (offsetting by ~one generation's worth of
// years per depth step), so unknown-birthdate people still land in roughly
// the right chronological neighborhood instead of colliding with unrelated
// generations.
function computeYears(people: Record<string, Person>, depths: Record<string, number>): Record<string, number> {
  const yearsByDepth = new Map<number, number[]>()
  for (const person of Object.values(people)) {
    const year = extractYear(person.birthDate)
    if (year === null) continue
    const d = depths[person.id]
    if (!yearsByDepth.has(d)) yearsByDepth.set(d, [])
    yearsByDepth.get(d)!.push(year)
  }

  const knownDepthAvg = new Map<number, number>()
  for (const [d, list] of yearsByDepth) {
    knownDepthAvg.set(d, list.reduce((a, b) => a + b, 0) / list.length)
  }

  const resolvedDepthYear = new Map<number, number>()
  function resolveDepthYear(d: number): number {
    const cached = resolvedDepthYear.get(d)
    if (cached !== undefined) return cached
    if (knownDepthAvg.has(d)) {
      const v = knownDepthAvg.get(d)!
      resolvedDepthYear.set(d, v)
      return v
    }
    let best: number | null = null
    let bestDist = Infinity
    for (const [kd, kv] of knownDepthAvg) {
      const dist = Math.abs(kd - d)
      if (dist < bestDist) {
        bestDist = dist
        best = kv + (d - kd) * GENERATION_YEARS
      }
    }
    const value = best ?? d * GENERATION_YEARS
    resolvedDepthYear.set(d, value)
    return value
  }

  const years: Record<string, number> = {}
  for (const person of Object.values(people)) {
    const own = extractYear(person.birthDate)
    years[person.id] = own !== null ? own : resolveDepthYear(depths[person.id])
  }
  return years
}

export function computeLayout(people: Record<string, Person>): Layout {
  const depths = computeDepths(people)
  const years = computeYears(people, depths)
  const ids = Object.keys(people)

  const bandOf = (id: string) => Math.round(years[id] / BAND_YEARS)

  const bands = new Map<number, string[]>()
  for (const id of ids) {
    const b = bandOf(id)
    if (!bands.has(b)) bands.set(b, [])
    bands.get(b)!.push(id)
  }
  const sortedBands = [...bands.keys()].sort((a, b) => a - b)
  const xIndex: Record<string, number> = {}

  function orderBand(band: number, useParents: boolean) {
    const row = bands.get(band)!
    const barycenterOf = (id: string): number => {
      const person = people[id]
      const primaryRefs = useParents
        ? [person.motherId, person.fatherId].filter((pid): pid is string => Boolean(pid))
        : childrenOf.get(id) ?? []
      // Spouses can now land in a different band (chronological Y instead of
      // a shared generation row), so the same-band adjacency pass below can't
      // always reach them — pulling spouse position into the barycenter too
      // keeps married couples horizontally close even across band lines.
      const refIds = [...primaryRefs, ...person.spouseIds.filter((sid) => people[sid])]
      const known = refIds.filter((rid) => xIndex[rid] !== undefined).map((rid) => xIndex[rid])
      if (known.length === 0) return xIndex[id] ?? Number.MAX_SAFE_INTEGER
      return known.reduce((a, b) => a + b, 0) / known.length
    }
    const ordered = [...row].sort((a, b) => {
      const diff = barycenterOf(a) - barycenterOf(b)
      if (diff !== 0) return diff
      return people[a].name.localeCompare(people[b].name)
    })

    // Adjacency pass: pull same-band spouses next to each other
    const finalOrder: string[] = []
    const placed = new Set<string>()
    for (const id of ordered) {
      if (placed.has(id)) continue
      finalOrder.push(id)
      placed.add(id)
      for (const spouseId of people[id].spouseIds) {
        if (row.includes(spouseId) && !placed.has(spouseId)) {
          finalOrder.push(spouseId)
          placed.add(spouseId)
        }
      }
    }
    finalOrder.forEach((id, i) => {
      xIndex[id] = i
    })
    bands.set(band, finalOrder)
  }

  const childrenOf = new Map<string, string[]>()
  for (const person of Object.values(people)) {
    for (const parentId of [person.motherId, person.fatherId]) {
      if (!parentId || !people[parentId]) continue
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, [])
      childrenOf.get(parentId)!.push(person.id)
    }
  }

  // Initial down-sweep: oldest band first, ordered by name; every later band
  // barycenters against its parents' already-placed positions.
  for (const band of sortedBands) {
    if (band === sortedBands[0]) {
      const row = bands.get(band)!
      const ordered = [...row].sort((a, b) => people[a].name.localeCompare(people[b].name))
      const placed = new Set<string>()
      const finalOrder: string[] = []
      for (const id of ordered) {
        if (placed.has(id)) continue
        finalOrder.push(id)
        placed.add(id)
        for (const spouseId of people[id].spouseIds) {
          if (row.includes(spouseId) && !placed.has(spouseId)) {
            finalOrder.push(spouseId)
            placed.add(spouseId)
          }
        }
      }
      finalOrder.forEach((id, i) => (xIndex[id] = i))
      bands.set(band, finalOrder)
    } else {
      orderBand(band, true)
    }
  }

  // Crossing-reduction refinement: alternate a few up-sweeps (barycenter
  // against children) and down-sweeps (against parents) so the initial
  // single-pass order settles into fewer line crossings overall.
  for (let iter = 0; iter < 2; iter++) {
    for (const band of [...sortedBands].reverse()) orderBand(band, false)
    for (const band of sortedBands) orderBand(band, true)
  }

  // Assign real x-coordinates bottom-up: a parent is centered over the average
  // position of its own children, falling back to sequential spacing when a
  // person has no children yet.
  const x: Record<string, number> = {}
  for (const band of [...sortedBands].reverse()) {
    const row = bands.get(band)!
    let prevX: number | null = null
    for (const id of row) {
      const kids = (childrenOf.get(id) ?? []).filter((cid) => x[cid] !== undefined)
      const minX = prevX === null ? 0 : prevX + COL_WIDTH
      const desired = kids.length > 0 ? kids.reduce((sum, cid) => sum + x[cid], 0) / kids.length : minX
      x[id] = Math.max(desired, minX)
      prevX = x[id]
    }
  }

  const minYear = Math.min(...ids.map((id) => years[id]))
  const nodes: Record<string, LayoutNode> = {}
  for (const id of ids) {
    nodes[id] = {
      id,
      x: x[id],
      y: (years[id] - minYear) * YEAR_PX,
      depth: depths[id],
    }
  }

  // Safety sweep: the min-spacing guarantee above only holds *within* a
  // band. Two people who land in adjacent bands (e.g. a couple a couple
  // years apart in age) never get compared against each other there, so
  // close-but-different-band pairs can still end up visually overlapping —
  // catch those here regardless of band boundaries.
  const NODE_BOX_HEIGHT = 72
  const orderedByY = ids.slice().sort((a, b) => nodes[a].y - nodes[b].y)
  for (let i = 0; i < orderedByY.length; i++) {
    const id = orderedByY[i]
    for (let j = i - 1; j >= 0; j--) {
      const otherId = orderedByY[j]
      if (nodes[id].y - nodes[otherId].y >= NODE_BOX_HEIGHT) break
      if (Math.abs(nodes[id].x - nodes[otherId].x) < COL_WIDTH) {
        nodes[id].x = nodes[otherId].x + COL_WIDTH
      }
    }
  }

  const edges: LayoutEdge[] = []
  const seenSpousePairs = new Set<string>()
  for (const person of Object.values(people)) {
    if (person.motherId && people[person.motherId]) {
      edges.push({ kind: 'parent-child', from: person.motherId, to: person.id })
    }
    if (person.fatherId && people[person.fatherId]) {
      edges.push({ kind: 'parent-child', from: person.fatherId, to: person.id })
    }
    for (const spouseId of person.spouseIds) {
      if (!people[spouseId]) continue
      const key = [person.id, spouseId].sort().join('|')
      if (seenSpousePairs.has(key)) continue
      seenSpousePairs.add(key)
      edges.push({ kind: 'spouse', from: person.id, to: spouseId })
    }
  }

  return { nodes, edges, rowHeight: ROW_HEIGHT, colWidth: COL_WIDTH }
}
