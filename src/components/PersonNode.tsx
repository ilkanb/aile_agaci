import { memo } from 'react'
import type { Gender, Person } from '../types'
import { NODE_WIDTH, NODE_HEIGHT } from '../lib/connections'

export type Lod = 'dot' | 'label' | 'card'

interface Props {
  person: Person
  x: number
  y: number
  lod: Lod
  isSelected: boolean
  onClick: (id: string) => void
}

function borderColorFor(person: Person): string {
  if (person.gender === 'K') return 'var(--rose)'
  if (person.gender === 'E') return 'var(--pine)'
  return 'var(--text-dim)'
}

// Genogram-style shape convention: circle = kadın, square = erkek, triangle = bilinmiyor.
function GenderShape({ gender, size, color }: { gender: Gender; size: number; color: string }) {
  if (gender === 'K') {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
        <circle cx="5" cy="5" r="4.5" fill={color} />
      </svg>
    )
  }
  if (gender === 'E') {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
        <rect x="0.5" y="0.5" width="9" height="9" fill={color} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
      <polygon points="5,0.5 9.5,9.3 0.5,9.3" fill={color} />
    </svg>
  )
}

export const PersonNode = memo(function PersonNode({ person, x, y, lod, isSelected, onClick }: Props) {
  const border = isSelected ? 'var(--gold)' : borderColorFor(person)

  if (lod === 'dot') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick(person.id)}
        title={person.name}
        style={{
          position: 'absolute',
          left: x + NODE_WIDTH / 2 - 7,
          top: y + NODE_HEIGHT / 2 - 7,
          width: 14,
          height: 14,
          cursor: 'pointer',
          filter: isSelected ? 'drop-shadow(0 0 3px var(--gold))' : 'none',
        }}
      >
        <GenderShape gender={person.gender} size={14} color={border} />
      </div>
    )
  }

  if (lod === 'label') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick(person.id)}
        style={{
          position: 'absolute',
          left: x,
          top: y + NODE_HEIGHT / 2 - 14,
          width: NODE_WIDTH,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--bg-elevated)',
          border: `1.5px solid ${border}`,
          borderRadius: 6,
          color: 'var(--text)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          padding: '0 8px',
          boxShadow: isSelected ? '0 0 0 3px rgba(212,175,55,0.4)' : 'none',
        }}
      >
        <GenderShape gender={person.gender} size={9} color={border} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</span>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(person.id)}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        background: 'var(--bg-elevated)',
        border: `2px solid ${border}`,
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
        boxShadow: isSelected ? '0 0 0 4px rgba(212,175,55,0.4)' : '0 2px 6px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <GenderShape gender={person.gender} size={10} color={border} />
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text)',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {person.name}
        </div>
      </div>
      {person.note && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {person.note}
        </div>
      )}
    </div>
  )
})
