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

export function computeLayout(people: Record<string, Person>): Layout {
  const depths = computeDepths(people)
  const ids = Object.keys(people)

  const rows = new Map<number, string[]>()
  for (const id of ids) {
    const d = depths[id]
    if (!rows.has(d)) rows.set(d, [])
    rows.get(d)!.push(id)
  }

  const sortedDepths = [...rows.keys()].sort((a, b) => a - b)
  const xIndex: Record<string, number> = {}

  for (const depth of sortedDepths) {
    const row = rows.get(depth)!
    let ordered: string[]

    if (depth === sortedDepths[0]) {
      // Root row: stable order by name for determinism
      ordered = [...row].sort((a, b) => people[a].name.localeCompare(people[b].name))
    } else {
      // Barycenter: average x-index of each person's known parents from previous rows
      const barycenterOf = (id: string): number => {
        const person = people[id]
        const parentIndices = [person.motherId, person.fatherId]
          .filter((pid): pid is string => Boolean(pid) && xIndex[pid as string] !== undefined)
          .map((pid) => xIndex[pid])
        if (parentIndices.length === 0) return Number.MAX_SAFE_INTEGER
        return parentIndices.reduce((a, b) => a + b, 0) / parentIndices.length
      }
      ordered = [...row].sort((a, b) => {
        const diff = barycenterOf(a) - barycenterOf(b)
        if (diff !== 0) return diff
        return people[a].name.localeCompare(people[b].name)
      })
    }

    // Adjacency pass: pull same-row spouses next to each other
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
    rows.set(depth, finalOrder)
  }

  // Assign real x-coordinates bottom-up: a parent is centered over the average
  // position of its own children, falling back to sequential spacing when a
  // person has no children yet. Without this, rows with very different sizes
  // (e.g. 3 grandparents vs. 14 grandchildren) drift apart and connector lines
  // sprawl across the whole map instead of hugging their own family branch.
  const childrenOf = new Map<string, string[]>()
  for (const person of Object.values(people)) {
    for (const parentId of [person.motherId, person.fatherId]) {
      if (!parentId || !people[parentId]) continue
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, [])
      childrenOf.get(parentId)!.push(person.id)
    }
  }

  const x: Record<string, number> = {}
  for (const depth of [...sortedDepths].reverse()) {
    const row = rows.get(depth)!
    let prevX: number | null = null
    for (const id of row) {
      const kids = (childrenOf.get(id) ?? []).filter((cid) => x[cid] !== undefined)
      const minX = prevX === null ? 0 : prevX + COL_WIDTH
      const desired = kids.length > 0 ? kids.reduce((sum, cid) => sum + x[cid], 0) / kids.length : minX
      x[id] = Math.max(desired, minX)
      prevX = x[id]
    }
  }

  const nodes: Record<string, LayoutNode> = {}
  for (const id of ids) {
    nodes[id] = {
      id,
      x: x[id],
      y: depths[id] * ROW_HEIGHT,
      depth: depths[id],
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
