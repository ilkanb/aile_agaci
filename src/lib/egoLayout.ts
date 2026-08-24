import type { Person } from '../types'
import { getChildren } from './family'
import type { Layout, LayoutEdge, LayoutNode } from './layout'
import { ROW_HEIGHT, COL_WIDTH } from './layout'

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

  nodes[focalId] = { id: focalId, x: 0, y: 0, depth: 0 }

  const placedSpouses = new Set<string>()
  focal.spouseIds.forEach((spouseId, i) => {
    if (!people[spouseId] || placedSpouses.has(spouseId)) return
    placedSpouses.add(spouseId)
    nodes[spouseId] = { id: spouseId, x: (i + 1) * COL_WIDTH, y: 0, depth: 0 }
    edges.push({ kind: 'spouse', from: focalId, to: spouseId })
  })

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
      nodes[personId] = {
        id: personId,
        x: (localIndex - (slotsAtGen - 1) / 2) * COL_WIDTH,
        y: -generation * ROW_HEIGHT,
        depth: -generation,
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

  // Descendants: DFS down, leaves get sequential slots, ancestors-of-leaves
  // (i.e. every non-leaf) get centered over the average of their children.
  const visitedDesc = new Set<string>([focalId, ...focal.spouseIds])
  let nextLeafX = 0

  function layoutDescendant(personId: string, depth: number): number {
    if (nodes[personId]) return nodes[personId].x
    visitedDesc.add(personId)
    const person = people[personId]
    const children = getChildren(person, people).filter((c) => !visitedDesc.has(c.id))

    let x: number
    if (children.length === 0) {
      x = nextLeafX
      nextLeafX += COL_WIDTH
    } else {
      const childXs = children.map((c) => layoutDescendant(c.id, depth + 1))
      x = childXs.reduce((a, b) => a + b, 0) / childXs.length
    }

    nodes[personId] = { id: personId, x, y: depth * ROW_HEIGHT, depth }
    edges.push(
      ...[person.motherId, person.fatherId]
        .filter((pid): pid is string => Boolean(pid) && Boolean(nodes[pid as string]))
        .map((pid) => ({ kind: 'parent-child' as const, from: pid, to: personId }))
    )

    for (const spouseId of person.spouseIds) {
      if (!people[spouseId] || visitedDesc.has(spouseId)) continue
      visitedDesc.add(spouseId)
      nodes[spouseId] = { id: spouseId, x: x + COL_WIDTH, y: depth * ROW_HEIGHT, depth }
      edges.push({ kind: 'spouse', from: personId, to: spouseId })
      nextLeafX = Math.max(nextLeafX, x + COL_WIDTH * 2)
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
