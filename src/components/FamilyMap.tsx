import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import 'd3-transition'
import type { Person } from '../types'
import { computeLayout } from '../lib/layout'
import { computeConnections, NODE_WIDTH, NODE_HEIGHT } from '../lib/connections'
import { PersonNode, type Lod } from './PersonNode'

interface Props {
  people: Record<string, Person>
  selectedId: string | null
  onSelect: (id: string) => void
}

export interface FamilyMapHandle {
  focusOn: (id: string) => void
  fit: () => void
  zoomBy: (factor: number) => void
}

function lodFor(k: number): Lod {
  if (k < 0.45) return 'dot'
  if (k < 0.85) return 'label'
  return 'card'
}

export const FamilyMap = forwardRef<FamilyMapHandle, Props>(function FamilyMap({ people, selectedId, onSelect }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null)
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity)

  const layout = useMemo(() => computeLayout(people), [people])
  const connections = useMemo(() => computeConnections(layout, people), [layout, people])

  const bounds = useMemo(() => {
    const nodes = Object.values(layout.nodes)
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 }
    return {
      minX: Math.min(...nodes.map((n) => n.x)) - 40,
      minY: Math.min(...nodes.map((n) => n.y)) - 40,
      maxX: Math.max(...nodes.map((n) => n.x)) + NODE_WIDTH + 40,
      maxY: Math.max(...nodes.map((n) => n.y)) + NODE_HEIGHT + 40,
    }
  }, [layout])

  useEffect(() => {
    if (!containerRef.current) return
    const behavior = d3zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.15, 2.5])
      .on('zoom', (event: D3ZoomEvent<HTMLDivElement, unknown>) => setTransform(event.transform))
    zoomBehaviorRef.current = behavior
    select(containerRef.current).call(behavior)
    // initial: fit to content
    const el = containerRef.current
    const w = el.clientWidth
    const h = el.clientHeight
    const contentW = bounds.maxX - bounds.minX
    const contentH = bounds.maxY - bounds.minY
    const k = Math.min(1, Math.min(w / contentW, h / contentH))
    const initial = zoomIdentity
      .translate(w / 2 - ((bounds.minX + bounds.maxX) / 2) * k, h / 2 - ((bounds.minY + bounds.maxY) / 2) * k)
      .scale(k)
    select(el).call(behavior.transform, initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    focusOn(id: string) {
      const node = layout.nodes[id]
      const el = containerRef.current
      const behavior = zoomBehaviorRef.current
      if (!node || !el || !behavior) return
      const w = el.clientWidth
      const h = el.clientHeight
      const targetK = Math.max(transform.k, 0.95)
      const cx = node.x + NODE_WIDTH / 2
      const cy = node.y + NODE_HEIGHT / 2
      const next = zoomIdentity.translate(w / 2 - cx * targetK, h / 2 - cy * targetK).scale(targetK)
      select(el).transition().duration(400).call(behavior.transform, next)
    },
    fit() {
      const el = containerRef.current
      const behavior = zoomBehaviorRef.current
      if (!el || !behavior) return
      const w = el.clientWidth
      const h = el.clientHeight
      const contentW = bounds.maxX - bounds.minX
      const contentH = bounds.maxY - bounds.minY
      const k = Math.min(1, Math.min(w / contentW, h / contentH))
      const next = zoomIdentity
        .translate(w / 2 - ((bounds.minX + bounds.maxX) / 2) * k, h / 2 - ((bounds.minY + bounds.maxY) / 2) * k)
        .scale(k)
      select(el).transition().duration(400).call(behavior.transform, next)
    },
    zoomBy(factor: number) {
      const el = containerRef.current
      const behavior = zoomBehaviorRef.current
      if (!el || !behavior) return
      const center: [number, number] = [el.clientWidth / 2, el.clientHeight / 2]
      select(el).transition().duration(200).call(behavior.scaleBy, factor, center)
    },
  }))

  const lod = lodFor(transform.k)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor: 'grab',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          style={{
            position: 'absolute',
            left: bounds.minX,
            top: bounds.minY,
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY,
            pointerEvents: 'none',
          }}
          viewBox={`${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`}
        >
          {connections.map((c) => (
            <path
              key={c.id}
              d={c.d}
              fill="none"
              stroke={c.kind === 'spouse' ? 'var(--gold-soft)' : 'var(--text-dim)'}
              strokeWidth={c.kind === 'spouse' ? 2 : 1.5}
              strokeDasharray={c.kind === 'spouse' ? '4 3' : undefined}
              opacity={0.75}
            />
          ))}
        </svg>
        {Object.values(layout.nodes).map((node) => (
          <PersonNode
            key={node.id}
            person={people[node.id]}
            x={node.x}
            y={node.y}
            lod={lod}
            isSelected={node.id === selectedId}
            onClick={onSelect}
          />
        ))}
      </div>
    </div>
  )
})
