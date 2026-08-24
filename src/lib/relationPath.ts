import type { Gender, Person } from '../types'
import { getSiblings, getChildren, getSpouses, getParents } from './family'

type RelationKind = 'mother' | 'father' | 'sibling-full' | 'sibling-half' | 'spouse' | 'child'
type AgeRel = 'older' | 'younger' | null

export interface RelationStep {
  toId: string
  relation: RelationKind
  childGender?: Gender
  siblingGender?: Gender
  siblingAge?: AgeRel
}

function compareAge(targetBirthDate: string | undefined, ownBirthDate: string | undefined): AgeRel {
  if (!targetBirthDate || !ownBirthDate) return null
  const t = new Date(targetBirthDate).getTime()
  const o = new Date(ownBirthDate).getTime()
  if (Number.isNaN(t) || Number.isNaN(o) || t === o) return null
  return t < o ? 'older' : 'younger'
}

// BFS over the family graph (parent/child/spouse/sibling edges) to find the
// shortest chain of everyday relation words connecting two people, e.g.
// "annesinin kardeşinin eşi" instead of forcing users to trace the raw graph.
export function findRelationPath(
  people: Record<string, Person>,
  fromId: string,
  toId: string
): RelationStep[] | null {
  if (fromId === toId) return []
  if (!people[fromId] || !people[toId]) return null

  const visited = new Set<string>([fromId])
  const queue: { id: string; path: RelationStep[] }[] = [{ id: fromId, path: [] }]

  while (queue.length > 0) {
    const { id, path } = queue.shift()!
    const person = people[id]

    const neighbors: RelationStep[] = []
    for (const parent of getParents(person, people)) {
      neighbors.push({ toId: parent.id, relation: parent.id === person.motherId ? 'mother' : 'father' })
    }
    for (const child of getChildren(person, people)) {
      neighbors.push({ toId: child.id, relation: 'child', childGender: child.gender })
    }
    for (const spouse of getSpouses(person, people)) {
      neighbors.push({ toId: spouse.id, relation: 'spouse' })
    }
    for (const { person: sibling, kind } of getSiblings(person, people)) {
      neighbors.push({
        toId: sibling.id,
        relation: kind === 'full' ? 'sibling-full' : 'sibling-half',
        siblingGender: sibling.gender,
        siblingAge: compareAge(sibling.birthDate, person.birthDate),
      })
    }

    for (const step of neighbors) {
      if (visited.has(step.toId)) continue
      const nextPath = [...path, step]
      if (step.toId === toId) return nextPath
      visited.add(step.toId)
      queue.push({ id: step.toId, path: nextPath })
    }
  }

  return null
}

const REL_WORDS: Record<'mother' | 'father' | 'spouse', { poss: string; possGen: string }> = {
  mother: { poss: 'annesi', possGen: 'annesinin' },
  father: { poss: 'babası', possGen: 'babasının' },
  spouse: { poss: 'eşi', possGen: 'eşinin' },
}

function childWord(gender: Gender | undefined, isFinal: boolean): string {
  if (gender === 'K') return isFinal ? 'kızı' : 'kızının'
  if (gender === 'E') return isFinal ? 'oğlu' : 'oğlunun'
  return isFinal ? 'çocuğu' : 'çocuğunun'
}

// Doğum tarihi bilinen kardeşler için ağabey/abla (büyük) ya da erkek/kız
// kardeş (küçük) ayrımı yapılır; tarih yoksa cinsiyete göre nötr "kardeşi"ne düşülür.
function siblingWord(isHalf: boolean, age: AgeRel, gender: Gender | undefined, isFinal: boolean): string {
  const prefix = isHalf ? 'üvey ' : ''
  let poss: string
  let possGen: string

  if (age === 'older') {
    if (gender === 'E') [poss, possGen] = ['ağabeyi', 'ağabeyinin']
    else if (gender === 'K') [poss, possGen] = ['ablası', 'ablasının']
    else [poss, possGen] = ['büyük kardeşi', 'büyük kardeşinin']
  } else if (age === 'younger') {
    if (gender === 'E') [poss, possGen] = ['erkek kardeşi', 'erkek kardeşinin']
    else if (gender === 'K') [poss, possGen] = ['kız kardeşi', 'kız kardeşinin']
    else [poss, possGen] = ['küçük kardeşi', 'küçük kardeşinin']
  } else if (gender === 'E') {
    [poss, possGen] = ['erkek kardeşi', 'erkek kardeşinin']
  } else if (gender === 'K') {
    [poss, possGen] = ['kız kardeşi', 'kız kardeşinin']
  } else {
    [poss, possGen] = ['kardeşi', 'kardeşinin']
  }

  return prefix + (isFinal ? poss : possGen)
}

export function describeRelationPath(steps: RelationStep[]): string {
  return steps
    .map((step, i) => {
      const isFinal = i === steps.length - 1
      if (step.relation === 'child') return childWord(step.childGender, isFinal)
      if (step.relation === 'sibling-full' || step.relation === 'sibling-half') {
        return siblingWord(step.relation === 'sibling-half', step.siblingAge ?? null, step.siblingGender, isFinal)
      }
      const words = REL_WORDS[step.relation]
      return isFinal ? words.poss : words.possGen
    })
    .join(' ')
}
