import { useMemo, useState } from 'react'
import type { Person } from '../types'
import { findRelationPath, describeRelationPath } from '../lib/relationPath'
import { turkishGenitive } from '../lib/turkish'
import { PersonPickerLabel } from './PersonPickerLabel'

interface Props {
  person: Person
  people: Record<string, Person>
}

export function RelationFinder({ person, people }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLocaleLowerCase('tr')
    return Object.values(people)
      .filter((p) => p.id !== person.id && p.name.toLocaleLowerCase('tr').includes(q))
      .slice(0, 6)
  }, [query, people, person.id])

  const target = targetId ? people[targetId] : null

  const sentence = useMemo(() => {
    if (!target) return null
    const path = findRelationPath(people, person.id, target.id)
    if (path === null) return `${target.name} ile ${person.name} arasında bilinen bir bağlantı yok.`
    if (path.length === 0) return 'Aynı kişi.'
    return `${target.name}, ${turkishGenitive(person.name)} ${describeRelationPath(path)}.`
  }, [target, people, person])

  if (!open) {
    return (
      <button className="ghost-btn" onClick={() => setOpen(true)}>
        İlişkiyi bul
      </button>
    )
  }

  return (
    <div className="relation-finder">
      <div className="relation-finder-row">
        <input
          placeholder={`${person.name} ile ilişkisini görmek istediğin kişi...`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setTargetId(null)
          }}
          autoFocus
        />
        <button
          className="ghost-btn"
          onClick={() => {
            setOpen(false)
            setQuery('')
            setTargetId(null)
          }}
        >
          Kapat
        </button>
      </div>

      {!target && results.length > 0 && (
        <div className="search-results relation-finder-results">
          {results.map((p) => (
            <div
              key={p.id}
              className="search-result-item"
              onClick={() => {
                setTargetId(p.id)
                setQuery(p.name)
              }}
            >
              <PersonPickerLabel person={p} people={people} />
            </div>
          ))}
        </div>
      )}

      {sentence && <div className="relation-finder-result">{sentence}</div>}
    </div>
  )
}
