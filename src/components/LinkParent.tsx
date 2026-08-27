import { useMemo, useState } from 'react'
import type { Person } from '../types'
import { useFamilyStore } from '../store/familyStore'
import { isSelfOrDescendant } from '../lib/family'
import { PersonPickerLabel } from './PersonPickerLabel'

interface Props {
  person: Person
  people: Record<string, Person>
  username: string
  canApprove: boolean
  slot: 'mother' | 'father'
}

const SLOT_LABEL = { mother: 'Anne', father: 'Baba' } as const

export function LinkParent({ person, people, username, canApprove, slot }: Props) {
  const submitAction = useFamilyStore((s) => s.submitAction)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLocaleLowerCase('tr')
    return Object.values(people)
      // Linking someone already reachable below this person as their parent
      // would make them their own ancestor — filter those out entirely.
      .filter((p) => !isSelfOrDescendant(person.id, p.id, people) && p.name.toLocaleLowerCase('tr').includes(q))
      .slice(0, 6)
  }, [query, people, person.id])

  function close() {
    setOpen(false)
    setQuery('')
    setSubmitted(false)
  }

  function pick(targetId: string) {
    submitAction({
      type: 'link-parent',
      anchorPersonId: person.id,
      targetPersonId: targetId,
      parentSlot: slot,
      createdBy: username,
      autoApprove: canApprove,
    })
    setSubmitted(true)
  }

  if (!open) {
    return (
      <button className="ghost-btn" onClick={() => setOpen(true)}>
        {SLOT_LABEL[slot]} olarak bağla (mevcut kişi)
      </button>
    )
  }

  return (
    <div className="relation-finder">
      <div className="relation-finder-row">
        <input
          placeholder={`${person.name} için ${SLOT_LABEL[slot].toLocaleLowerCase('tr')} olarak bağlanacak kişi...`}
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
              <PersonPickerLabel person={p} people={people} />
            </div>
          ))}
        </div>
      )}

      {submitted && (
        <div className="relation-finder-result">
          {canApprove ? 'Bağlandı.' : 'Onaya gönderildi.'}
        </div>
      )}
    </div>
  )
}
