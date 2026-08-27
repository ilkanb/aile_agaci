import { useMemo, useState } from 'react'
import type { Person } from '../types'
import { PersonPickerLabel } from './PersonPickerLabel'

interface Props {
  people: Record<string, Person>
  onPick: (id: string) => void
}

export function SearchBox({ people, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLocaleLowerCase('tr')
    return Object.values(people)
      .filter((p) => p.name.toLocaleLowerCase('tr').includes(q))
      .slice(0, 8)
  }, [query, people])

  return (
    <div className="search-box">
      <input
        placeholder="İsimle ara..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((p) => (
            <div
              key={p.id}
              className="search-result-item"
              onClick={() => {
                onPick(p.id)
                setQuery(p.name)
                setOpen(false)
              }}
            >
              <PersonPickerLabel person={p} people={people} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
