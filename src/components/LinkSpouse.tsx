import { useMemo, useState } from 'react'
import type { Person } from '../types'
import { useFamilyStore } from '../store/familyStore'
import { getSpouses } from '../lib/family'

interface Props {
  person: Person
  people: Record<string, Person>
  username: string
  canApprove: boolean
}

export function LinkSpouse({ person, people, username, canApprove }: Props) {
  const submitAction = useFamilyStore((s) => s.submitAction)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const alreadySpouseIds = useMemo(() => new Set(getSpouses(person, people).map((p) => p.id)), [person, people])

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLocaleLowerCase('tr')
    return Object.values(people)
      .filter((p) => p.id !== person.id && !alreadySpouseIds.has(p.id) && p.name.toLocaleLowerCase('tr').includes(q))
      .slice(0, 6)
  }, [query, people, person.id, alreadySpouseIds])

  function close() {
    setOpen(false)
    setQuery('')
    setSubmitted(false)
  }

  function pick(targetId: string) {
    submitAction({
      type: 'link-spouse',
      anchorPersonId: person.id,
      targetPersonId: targetId,
      createdBy: username,
      autoApprove: canApprove,
    })
    setSubmitted(true)
  }

  if (!open) {
    return (
      <button className="ghost-btn" onClick={() => setOpen(true)}>
        Eşleştir (mevcut kişi)
      </button>
    )
  }

  return (
    <div className="relation-finder">
      <div className="relation-finder-row">
        <input
          placeholder={`${person.name} ile eşleştirmek istediğin kişi...`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSubmitted(false)
          }}
          autoFocus
        />
        <button className="ghost-btn" onClick={close}>Kapat</button>
      </div>

      {!submitted && results.length > 0 && (
        <div className="search-results relation-finder-results">
          {results.map((p) => (
            <div key={p.id} className="search-result-item" onClick={() => pick(p.id)}>
              {p.name}
            </div>
          ))}
        </div>
      )}

      {submitted && (
        <div className="relation-finder-result">
          {canApprove ? 'Eşleştirildi.' : 'Onaya gönderildi.'}
        </div>
      )}
    </div>
  )
}
