import type { Person } from '../types'
import type { Layout } from './layout'

export const NODE_WIDTH = 120
export const NODE_HEIGHT = 72

export interface ConnectionPath {
  id: string
  d: string
  kind: 'parent-child' | 'spouse'
}

function centerX(layout: Layout, id: string): number {
  return layout.nodes[id].x + NODE_WIDTH / 2
}

export function computeConnections(layout: Layout, people: Record<string, Person>): ConnectionPath[] {
  const paths: ConnectionPath[] = []

  // Spouse lines: straight horizontal segment between the two boxes
  for (const edge of layout.edges) {
    if (edge.kind !== 'spouse') continue
    const a = layout.nodes[edge.from]
    const b = layout.nodes[edge.to]
    if (!a || !b) continue
    const y = a.y + NODE_HEIGHT / 2
    const x1 = Math.min(a.x, b.x) + NODE_WIDTH
    const x2 = Math.max(a.x, b.x)
    paths.push({ id: `spouse-${edge.from}-${edge.to}`, kind: 'spouse', d: `M${x1},${y} L${x2},${y}` })
  }

  // Parent-child: group children by their exact parent pair so siblings share one drop line
  const groups = new Map<string, { motherId: string | null; fatherId: string | null; children: string[] }>()
  for (const person of Object.values(people)) {
    if (!person.motherId && !person.fatherId) continue
    if (!layout.nodes[person.id]) continue
    const key = `${person.motherId ?? '-'}|${person.fatherId ?? '-'}`
    if (!groups.has(key)) groups.set(key, { motherId: person.motherId, fatherId: person.fatherId, children: [] })
    groups.get(key)!.children.push(person.id)
  }

  for (const [key, group] of groups) {
    const parentIds = [group.motherId, group.fatherId].filter(
      (pid): pid is string => Boolean(pid) && Boolean(layout.nodes[pid as string])
    )
    if (parentIds.length === 0) continue

    const parentXs = parentIds.map((pid) => centerX(layout, pid))
    const parentAnchorX = parentXs.reduce((a, b) => a + b, 0) / parentXs.length
    const parentY = Math.max(...parentIds.map((pid) => layout.nodes[pid].y)) + NODE_HEIGHT

    const childXs = group.children.map((cid) => centerX(layout, cid))
    const childTopY = Math.min(...group.children.map((cid) => layout.nodes[cid].y))
    const busY = parentY + (childTopY - parentY) / 2

    const busMinX = Math.min(parentAnchorX, ...childXs)
    const busMaxX = Math.max(parentAnchorX, ...childXs)

    let d = `M${parentAnchorX},${parentY} L${parentAnchorX},${busY} M${busMinX},${busY} L${busMaxX},${busY}`
    for (const cid of group.children) {
      const cx = centerX(layout, cid)
      d += ` M${cx},${busY} L${cx},${layout.nodes[cid].y}`
    }

    paths.push({ id: `pc-${key}`, kind: 'parent-child', d })
  }

  return paths
}
