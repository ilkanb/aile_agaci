import type { Person } from '../types'
import { getChildren } from './family'
import type { Layout, LayoutEdge, LayoutNode } from './layout'
import { ROW_HEIGHT, COL_WIDTH } from './layout'
import { cardWidthFor, GUTTER } from './nodeSize'

// A "merkeze al" view: redraws the map with a single chosen person at the
// center. Ancestors fan out symmetrically above using classic ahnentafel
// numbering (father's line = index*2, mother's line = index*2+1), so each
// side's ancestors cluster under their own half instead of being mixed with
// the sibling/barycenter ordering used by the whole-tree layout. Descendants
// fan out below using the same bottom-up centering technique as the main
// layout, but scoped to just this person's own subtree.
export function computeEgoLayout(people: Record<string, Person>, focalId: string): Layout {
  const nodes: Record<string, LayoutNode> = {}
  const edges: LayoutEdge[] = []
  const focal = people[focalId]
  if (!focal) return { nodes, edges, rowHeight: ROW_HEIGHT, colWidth: COL_WIDTH }

  const widthOf = (id: string) => cardWidthFor(people[id])

  nodes[focalId] = { id: focalId, x: 0, y: 0, depth: 0, width: widthOf(focalId) }

  const placedSpouses = new Set<string>()
  let spouseRightEdge = widthOf(focalId) + GUTTER
  focal.spouseIds.forEach((spouseId) => {
    if (!people[spouseId] || placedSpouses.has(spouseId)) return
    placedSpouses.add(spouseId)
    const w = widthOf(spouseId)
    nodes[spouseId] = { id: spouseId, x: spouseRightEdge, y: 0, depth: 0, width: w }
    spouseRightEdge += w + GUTTER
    edges.push({ kind: 'spouse', from: focalId, to: spouseId })
  })

  // Pre-pass: the widest box at each ancestor generation, so slot spacing at
  // that generation never collides regardless of which names actually land
  // there (ahnentafel slots are evenly spaced, so one shared slot width per
  // generation keeps every sibling-generation pair apart).
  const maxWidthAtGen = new Map<number, number>()
  const seenForWidth = new Set<string>([focalId])
  function scanAncestorWidths(personId: string, generation: number) {
    const person = people[personId]
    if (!person) return
    if (generation > 0) {
      maxWidthAtGen.set(generation, Math.max(maxWidthAtGen.get(generation) ?? 0, widthOf(personId)))
    }
    if (person.fatherId && people[person.fatherId] && !seenForWidth.has(person.fatherId)) {
      seenForWidth.add(person.fatherId)
      scanAncestorWidths(person.fatherId, generation + 1)
    }
    if (person.motherId && people[person.motherId] && !seenForWidth.has(person.motherId)) {
      seenForWidth.add(person.motherId)
      scanAncestorWidths(person.motherId, generation + 1)
    }
  }
  scanAncestorWidths(focalId, 0)

  // Ancestors: ahnentafel index 1 = focal, 2i = father, 2i+1 = mother.
  // A person can only ever occupy one slot — guards against endogamy (a
  // shared ancestor reachable via both parents) creating duplicate nodes.
  const placedAncestors = new Set<string>([focalId])
  function addAncestors(personId: string, ahnIndex: number, generation: number) {
    const person = people[personId]
    if (!person) return
    if (generation > 0) {
      const slotsAtGen = 2 ** generation
      const localIndex = ahnIndex - slotsAtGen
      const slotWidth = (maxWidthAtGen.get(generation) ?? COL_WIDTH) + GUTTER
      nodes[personId] = {
        id: personId,
        x: (localIndex - (slotsAtGen - 1) / 2) * slotWidth,
        y: -generation * ROW_HEIGHT,
        depth: -generation,
        width: widthOf(personId),
      }
    }
    if (person.fatherId && people[person.fatherId] && !placedAncestors.has(person.fatherId)) {
      placedAncestors.add(person.fatherId)
      edges.push({ kind: 'parent-child', from: person.fatherId, to: personId })
      addAncestors(person.fatherId, ahnIndex * 2, generation + 1)
    }
    if (person.motherId && people[person.motherId] && !placedAncestors.has(person.motherId)) {
      placedAncestors.add(person.motherId)
      edges.push({ kind: 'parent-child', from: person.motherId, to: personId })
      addAncestors(person.motherId, ahnIndex * 2 + 1, generation + 1)
    }
  }
  addAncestors(focalId, 1, 0)

  // Descendants: DFS down, leaves get sequential slots (each reserving its
  // own width so long names don't overlap their neighbor), non-leaves get
  // centered over the average of their children.
  const visitedDesc = new Set<string>([focalId, ...focal.spouseIds])
  let nextLeafX = 0

  function layoutDescendant(personId: string, depth: number): number {
    if (nodes[personId]) return nodes[personId].x
    visitedDesc.add(personId)
    const person = people[personId]
    const children = getChildren(person, people).filter((c) => !visitedDesc.has(c.id))
    const w = widthOf(personId)

    let x: number
    if (children.length === 0) {
      x = nextLeafX
      nextLeafX += w + GUTTER
    } else {
      const childXs = children.map((c) => layoutDescendant(c.id, depth + 1))
      x = childXs.reduce((a, b) => a + b, 0) / childXs.length
    }

    nodes[personId] = { id: personId, x, y: depth * ROW_HEIGHT, depth, width: w }
    edges.push(
      ...[person.motherId, person.fatherId]
        .filter((pid): pid is string => Boolean(pid) && Boolean(nodes[pid as string]))
        .map((pid) => ({ kind: 'parent-child' as const, from: pid, to: personId }))
    )

    for (const spouseId of person.spouseIds) {
      if (!people[spouseId] || visitedDesc.has(spouseId)) continue
      visitedDesc.add(spouseId)
      const sw = widthOf(spouseId)
      nodes[spouseId] = { id: spouseId, x: x + w + GUTTER, y: depth * ROW_HEIGHT, depth, width: sw }
      edges.push({ kind: 'spouse', from: personId, to: spouseId })
      nextLeafX = Math.max(nextLeafX, x + w + GUTTER + sw + GUTTER)
    }

    return x
  }

  const focalChildren = getChildren(focal, people)
  if (focalChildren.length > 0) {
    const childXs = focalChildren.map((c) => layoutDescendant(c.id, 1))
    const mean = childXs.reduce((a, b) => a + b, 0) / childXs.length
    for (const node of Object.values(nodes)) {
      if (node.depth > 0) node.x -= mean
    }
  }

  return { nodes, edges, rowHeight: ROW_HEIGHT, colWidth: COL_WIDTH }
}
