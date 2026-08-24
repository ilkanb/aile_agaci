import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { FamilyState, Gender, Person, PendingAction, PendingActionType } from '../types'
import { supabase } from '../lib/supabaseClient'

interface PersonRow {
  id: string
  name: string
  gender: Gender
  mother_id: string | null
  father_id: string | null
  spouse_ids: string[]
  note: string
  birth_date: string | null
  photo_url: string | null
}

function rowToPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    motherId: row.mother_id,
    fatherId: row.father_id,
    spouseIds: row.spouse_ids ?? [],
    note: row.note ?? '',
    birthDate: row.birth_date ?? undefined,
    photoUrl: row.photo_url ?? undefined,
  }
}

function personToInsertRow(id: string, person: Omit<Person, 'id'>) {
  return {
    id,
    name: person.name,
    gender: person.gender,
    mother_id: person.motherId,
    father_id: person.fatherId,
    spouse_ids: person.spouseIds,
    note: person.note,
    birth_date: person.birthDate || null,
    photo_url: person.photoUrl ?? null,
  }
}

interface PendingRow {
  id: string
  type: PendingActionType
  created_at: string
  created_by: string
  anchor_person_id: string
  new_person: Omit<Person, 'id'> | null
  shared_parent: 'mother' | 'father' | 'both' | null
  other_parent_id: string | null
  note_value: string | null
  birth_date_value: string | null
  target_person_id: string | null
  status: 'pending' | 'approved' | 'rejected'
}

function rowToPending(row: PendingRow): PendingAction {
  return {
    id: row.id,
    type: row.type,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by,
    anchorPersonId: row.anchor_person_id,
    newPerson: row.new_person ?? undefined,
    sharedParent: row.shared_parent ?? undefined,
    otherParentId: row.other_parent_id,
    noteValue: row.note_value ?? undefined,
    birthDateValue: row.birth_date_value ?? undefined,
    targetPersonId: row.target_person_id ?? undefined,
    status: row.status,
  }
}

function pendingToInsertRow(action: PendingAction) {
  return {
    id: action.id,
    type: action.type,
    created_by: action.createdBy,
    anchor_person_id: action.anchorPersonId,
    new_person: action.newPerson ?? null,
    shared_parent: action.sharedParent ?? null,
    other_parent_id: action.otherParentId ?? null,
    note_value: action.noteValue ?? null,
    birth_date_value: action.birthDateValue || null,
    target_person_id: action.targetPersonId ?? null,
    status: action.status,
  }
}

// Applies an approved action as real writes against Supabase. Mirrors the
// old pure in-memory reducer 1:1, just performed as awaited table calls —
// RLS (people writable by admins only) is the actual enforcement layer, this
// only ever runs once a caller has already been allowed to auto-approve.
async function applyActionRemote(people: Record<string, Person>, action: PendingAction) {
  const anchor = people[action.anchorPersonId]
  if (!anchor) return

  if (action.type === 'edit-note') {
    await supabase.from('people').update({ note: action.noteValue ?? anchor.note }).eq('id', action.anchorPersonId)
    return
  }
  if (action.type === 'edit-birthdate') {
    await supabase.from('people').update({ birth_date: action.birthDateValue || null }).eq('id', action.anchorPersonId)
    return
  }
  if (action.type === 'link-spouse') {
    const targetId = action.targetPersonId
    const target = targetId ? people[targetId] : undefined
    if (!targetId || !target || targetId === action.anchorPersonId) return
    if (!anchor.spouseIds.includes(targetId)) {
      await supabase
        .from('people')
        .update({ spouse_ids: [...anchor.spouseIds, targetId] })
        .eq('id', action.anchorPersonId)
    }
    if (!target.spouseIds.includes(action.anchorPersonId)) {
      await supabase
        .from('people')
        .update({ spouse_ids: [...target.spouseIds, action.anchorPersonId] })
        .eq('id', targetId)
    }
    return
  }

  const newId = nanoid(8)
  const created = action.newPerson
  if (!created) return

  switch (action.type) {
    case 'add-mother': {
      await supabase.from('people').insert(personToInsertRow(newId, { ...created, gender: 'K', spouseIds: [] }))
      await supabase.from('people').update({ mother_id: newId }).eq('id', action.anchorPersonId)
      break
    }
    case 'add-father': {
      await supabase.from('people').insert(personToInsertRow(newId, { ...created, gender: 'E', spouseIds: [] }))
      await supabase.from('people').update({ father_id: newId }).eq('id', action.anchorPersonId)
      break
    }
    case 'add-spouse': {
      await supabase
        .from('people')
        .insert(personToInsertRow(newId, { ...created, spouseIds: [action.anchorPersonId] }))
      await supabase
        .from('people')
        .update({ spouse_ids: [...anchor.spouseIds, newId] })
        .eq('id', action.anchorPersonId)
      break
    }
    case 'add-sibling': {
      const shared = action.sharedParent ?? 'both'
      const motherId = shared === 'mother' || shared === 'both' ? anchor.motherId : null
      const fatherId = shared === 'father' || shared === 'both' ? anchor.fatherId : null
      await supabase
        .from('people')
        .insert(personToInsertRow(newId, { ...created, motherId, fatherId, spouseIds: [] }))
      break
    }
    case 'add-child': {
      const isMother = anchor.gender === 'K'
      const motherId = isMother ? action.anchorPersonId : action.otherParentId ?? null
      const fatherId = isMother ? action.otherParentId ?? null : action.anchorPersonId
      await supabase
        .from('people')
        .insert(personToInsertRow(newId, { ...created, motherId, fatherId, spouseIds: [] }))
      break
    }
  }
}

interface FamilyStore extends FamilyState {
  selectedPersonId: string | null
  ready: boolean
  initialized: boolean
  init: () => void
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
  }) => Promise<void>
  approveAction: (actionId: string) => Promise<void>
  rejectAction: (actionId: string) => Promise<void>
  updatePerson: (id: string, patch: Partial<Person>) => Promise<void>
  deletePerson: (id: string) => Promise<void>
}

export const useFamilyStore = create<FamilyStore>((set, get) => ({
  people: {},
  pending: [],
  selectedPersonId: null,
  ready: false,
  initialized: false,

  init: () => {
    if (get().initialized) return
    set({ initialized: true })

    Promise.all([
      supabase.from('people').select('*'),
      supabase.from('pending_actions').select('*'),
    ]).then(([peopleRes, pendingRes]) => {
      const people: Record<string, Person> = {}
      for (const row of (peopleRes.data as PersonRow[] | null) ?? []) people[row.id] = rowToPerson(row)
      const pending = ((pendingRes.data as PendingRow[] | null) ?? []).map(rowToPending)
      set({ people, pending, ready: true })
    })

    supabase
      .channel('people-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, (payload) => {
        set((state) => {
          const people = { ...state.people }
          if (payload.eventType === 'DELETE') delete people[(payload.old as PersonRow).id]
          else people[(payload.new as PersonRow).id] = rowToPerson(payload.new as PersonRow)
          return { people }
        })
      })
      .subscribe()

    supabase
      .channel('pending-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_actions' }, (payload) => {
        set((state) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as PendingRow).id
            return { pending: state.pending.filter((a) => a.id !== deletedId) }
          }
          const row = rowToPending(payload.new as PendingRow)
          const idx = state.pending.findIndex((a) => a.id === row.id)
          const pending = [...state.pending]
          if (idx >= 0) pending[idx] = row
          else pending.push(row)
          return { pending }
        })
      })
      .subscribe()
  },

  select: (id) => set({ selectedPersonId: id }),

  submitAction: async (input) => {
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
      await applyActionRemote(get().people, action)
    } else {
      await supabase.from('pending_actions').insert(pendingToInsertRow(action))
    }
  },

  approveAction: async (actionId) => {
    const action = get().pending.find((a) => a.id === actionId)
    if (!action) return
    await applyActionRemote(get().people, action)
    await supabase.from('pending_actions').delete().eq('id', actionId)
  },

  rejectAction: async (actionId) => {
    await supabase.from('pending_actions').delete().eq('id', actionId)
  },

  updatePerson: async (id, patch) => {
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.gender !== undefined) row.gender = patch.gender
    if (patch.motherId !== undefined) row.mother_id = patch.motherId
    if (patch.fatherId !== undefined) row.father_id = patch.fatherId
    if (patch.spouseIds !== undefined) row.spouse_ids = patch.spouseIds
    if (patch.note !== undefined) row.note = patch.note
    if (patch.birthDate !== undefined) row.birth_date = patch.birthDate || null
    if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl
    await supabase.from('people').update(row).eq('id', id)
  },

  deletePerson: async (id) => {
    const people = get().people
    const updates: PromiseLike<unknown>[] = []
    for (const person of Object.values(people)) {
      if (person.id === id) continue
      const row: Record<string, unknown> = {}
      if (person.motherId === id) row.mother_id = null
      if (person.fatherId === id) row.father_id = null
      if (person.spouseIds.includes(id)) row.spouse_ids = person.spouseIds.filter((sid) => sid !== id)
      if (Object.keys(row).length > 0) updates.push(supabase.from('people').update(row).eq('id', person.id))
    }
    await Promise.all(updates)
    await supabase.from('pending_actions').delete().eq('anchor_person_id', id)
    await supabase.from('people').delete().eq('id', id)
    set({ selectedPersonId: null })
  },
}))
