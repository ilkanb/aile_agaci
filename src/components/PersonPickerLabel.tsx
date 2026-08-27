import type { Person } from '../types'

interface Props {
  person: Person
  people: Record<string, Person>
}

// Plain name, unless someone else in the tree shares it exactly — then the
// father's (or mother's, if no father recorded) name is appended, muted, so
// picker lists ("Ahmet Sönmez" vs. "Ahmet Sönmez") stay tellable apart.
export function PersonPickerLabel({ person, people }: Props) {
  const hasDuplicate = Object.values(people).some((p) => p.id !== person.id && p.name === person.name)
  if (!hasDuplicate) return <>{person.name}</>

  const parentName =
    (person.fatherId && people[person.fatherId]?.name) || (person.motherId && people[person.motherId]?.name)

  return (
    <>
      {person.name}
      {parentName && <span style={{ color: 'var(--text-dim)' }}> ({parentName})</span>}
    </>
  )
}
