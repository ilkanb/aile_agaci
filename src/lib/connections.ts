import type { Person } from '../types'
import type { Layout } from './layout'

export const NODE_WIDTH = 120
export const NODE_HEIGHT = 72

export interface ConnectionPath {
  id: string
  d: string
  kind: 'parent-child' | 'spouse'
  // Person ids this segment is directly relevant to — lets the map highlight
  // just the selected person's own lines and fade the rest, since dense rows
  // (several unrelated marriages sharing a generation) otherwise read as one
  // tangled mess of overlapping bus lines.
  touches: string[]
}

function centerX(layout: Layout, id: string): number {
  const node = layout.nodes[id]
  return node.x + (node.width ?? NODE_WIDTH) / 2
}

export function computeConnections(layout: Layout, people: Record<string, Person>): ConnectionPath[] {
  const paths: ConnectionPath[] = []

  // Spouse lines: straight segment between the two boxes' vertical centers —
  // not always perfectly horizontal now that Y is chronological rather than
  // generation-locked (spouses can have different birth years).
  for (const edge of layout.edges) {
    if (edge.kind !== 'spouse') continue
    const a = layout.nodes[edge.from]
    const b = layout.nodes[edge.to]
    if (!a || !b) continue
    const ay = a.y + NODE_HEIGHT / 2
    const by = b.y + NODE_HEIGHT / 2
    const aOnLeft = a.x <= b.x
    const ax = aOnLeft ? a.x + (a.width ?? NODE_WIDTH) : a.x
    const bx = aOnLeft ? b.x : b.x + (b.width ?? NODE_WIDTH)
    paths.push({
      id: `spouse-${edge.from}-${edge.to}`,
      kind: 'spouse',
      d: `M${ax},${ay} L${bx},${by}`,
      touches: [edge.from, edge.to],
    })
  }

  // Parent-child: each relationship gets its own independent elbow line
  // (parent bottom -> midpoint -> child top). Y is chronological now, so
  // siblings no longer share one clean row to hang a single bus line off —
  // routing each edge independently keeps every connection correct even
  // when siblings' birth years spread them out vertically.
  for (const person of Object.values(people)) {
    if (!layout.nodes[person.id]) continue
    for (const parentId of [person.motherId, person.fatherId]) {
      if (!parentId || !layout.nodes[parentId]) continue
      const parent = layout.nodes[parentId]
      const child = layout.nodes[person.id]
      const parentX = centerX(layout, parentId)
      const childX = centerX(layout, person.id)
      const parentBottomY = parent.y + NODE_HEIGHT
      const childTopY = child.y
      const midY = parentBottomY + (childTopY - parentBottomY) / 2
      const d = `M${parentX},${parentBottomY} L${parentX},${midY} L${childX},${midY} L${childX},${childTopY}`
      paths.push({ id: `pc-${parentId}-${person.id}`, kind: 'parent-child', d, touches: [parentId, person.id] })
    }
  }

  return paths
}
