import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { FamilyState, Person, PendingAction, PendingActionType } from '../types'
import { samplePeople } from '../lib/sampleData'

const STORAGE_KEY = 'aile-agaci-state-v1'

interface StoredShape {
  people: Record<string, Person>
  pending: PendingAction[]
}

function loadInitial(): StoredShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt storage, fall back to sample data
  }
  return { people: samplePeople, pending: [] }
}

function persist(state: StoredShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

interface FamilyStore extends FamilyState {
  selectedPersonId: string | null
  select: (id: string | null) => void
  submitAction: (input: {
    type: PendingActionType
    anchorPersonId: string
    newPerson?: Omit<Person, 'id'>
    sharedParent?: 'mother' | 'father' | 'both'
    otherParentId?: string | null
    noteValue?: string
    birthDateValue?: string
    targetPersonId?: string
    createdBy: string
    autoApprove: boolean
  }) => void
  approveAction: (actionId: string) => void
  rejectAction: (actionId: string) => void
  updatePerson: (id: string, patch: Partial<Person>) => void
  deletePerson: (id: string) => void
}

function applyAction(people: Record<string, Person>, action: PendingAction): Record<string, Person> {
  const newId = nanoid(8)
  const next = { ...people }
  const anchor = next[action.anchorPersonId]

  if (action.type === 'edit-note') {
    next[action.anchorPersonId] = { ...anchor, note: action.noteValue ?? anchor.note }
    return next
  }

  if (action.type === 'edit-birthdate') {
    next[action.anchorPersonId] = { ...anchor, birthDate: action.birthDateValue || undefined }
    return next
  }

  if (action.type === 'link-spouse') {
    const targetId = action.targetPersonId
    const target = targetId ? next[targetId] : undefined
    if (!targetId || !target || targetId === action.anchorPersonId) return next
    if (!anchor.spouseIds.includes(targetId)) {
      next[action.anchorPersonId] = { ...anchor, spouseIds: [...anchor.spouseIds, targetId] }
    }
    if (!target.spouseIds.includes(action.anchorPersonId)) {
      next[targetId] = { ...target, spouseIds: [...target.spouseIds, action.anchorPersonId] }
    }
    return next
  }

  const created: Person = { id: newId, ...(action.newPerson as Omit<Person, 'id'>) }

  switch (action.type) {
    case 'add-mother': {
      next[newId] = { ...created, gender: 'K' }
      next[action.anchorPersonId] = { ...anchor, motherId: newId }
      break
    }
    case 'add-father': {
      next[newId] = { ...created, gender: 'E' }
      next[action.anchorPersonId] = { ...anchor, fatherId: newId }
      break
    }
    case 'add-spouse': {
      next[newId] = { ...created, spouseIds: [action.anchorPersonId] }
      next[action.anchorPersonId] = {
        ...anchor,
        spouseIds: [...anchor.spouseIds, newId],
      }
      break
    }
    case 'add-sibling': {
      const shared = action.sharedParent ?? 'both'
      const motherId = shared === 'mother' || shared === 'both' ? anchor.motherId : null
      const fatherId = shared === 'father' || shared === 'both' ? anchor.fatherId : null
      next[newId] = { ...created, motherId, fatherId }
      break
    }
    case 'add-child': {
      const isMother = anchor.gender === 'K'
      const motherId = isMother ? action.anchorPersonId : action.otherParentId ?? null
      const fatherId = isMother ? action.otherParentId ?? null : action.anchorPersonId
      next[newId] = { ...created, motherId, fatherId }
      break
    }
  }

  return next
}

export const useFamilyStore = create<FamilyStore>((set, get) => {
  const initial = loadInitial()

  return {
    people: initial.people,
    pending: initial.pending,
    selectedPersonId: null,

    select: (id) => set({ selectedPersonId: id }),

    submitAction: (input) => {
      const action: PendingAction = {
        id: nanoid(8),
        type: input.type,
        createdAt: Date.now(),
        createdBy: input.createdBy,
        anchorPersonId: input.anchorPersonId,
        newPerson: input.newPerson,
        sharedParent: input.sharedParent,
        otherParentId: input.otherParentId,
        noteValue: input.noteValue,
        birthDateValue: input.birthDateValue,
        targetPersonId: input.targetPersonId,
        status: input.autoApprove ? 'approved' : 'pending',
      }

      if (input.autoApprove) {
        const people = applyAction(get().people, action)
        const next = { people, pending: get().pending }
        persist(next)
        set(next)
      } else {
        const pending = [...get().pending, action]
        persist({ people: get().people, pending })
        set({ pending })
      }
    },

    approveAction: (actionId) => {
      const action = get().pending.find((a) => a.id === actionId)
      if (!action) return
      const people = applyAction(get().people, { ...action, status: 'approved' })
      const pending = get().pending.filter((a) => a.id !== actionId)
      persist({ people, pending })
      set({ people, pending })
    },

    rejectAction: (actionId) => {
      const pending = get().pending.filter((a) => a.id !== actionId)
      persist({ people: get().people, pending })
      set({ pending })
    },

    updatePerson: (id, patch) => {
      const people = { ...get().people, [id]: { ...get().people[id], ...patch } }
      persist({ people, pending: get().pending })
      set({ people })
    },

    deletePerson: (id) => {
      const people = { ...get().people }
      delete people[id]
      for (const person of Object.values(people)) {
        if (person.motherId === id) person.motherId = null
        if (person.fatherId === id) person.fatherId = null
        person.spouseIds = person.spouseIds.filter((sid) => sid !== id)
      }
      const pending = get().pending.filter((a) => a.anchorPersonId !== id)
      persist({ people, pending })
      set({ people, pending, selectedPersonId: null })
    },
  }
})
