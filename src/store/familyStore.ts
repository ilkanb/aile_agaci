import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { FamilyState, Gender, Person, PendingAction, PendingActionType } from '../types'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from './authStore'

interface PersonRow {
  id: string
  name: string
  gender: Gender
  mother_id: string | null
  father_id: string | null
  spouse_ids: string[]
  note: string
  birth_date: string | null
  death_date: string | null
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
    deathDate: row.death_date ?? undefined,
    photoUrl: row.photo_url ?? undefined,
  }
}

// Realtime delivers raw `people` table rows (views can't be subscribed to),
// so the column-masking the people_visible view does for unapproved viewers
// has to be re-applied client-side here — otherwise a live INSERT/UPDATE
// would leak note/birth_date/death_date/photo_url straight past the view.
function maskIfNeeded(row: PersonRow): PersonRow {
  const user = useAuthStore.getState().currentUser
  if (!user || user.approved || row.id === user.personId) return row
  return { ...row, note: '', birth_date: null, death_date: null, photo_url: null }
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
    death_date: person.deathDate || null,
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
  death_date_value: string | null
  target_person_id: string | null
  parent_slot: 'mother' | 'father' | null
  name_value: string | null
  gender_value: Gender | null
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
    deathDateValue: row.death_date_value ?? undefined,
    targetPersonId: row.target_person_id ?? undefined,
    parentSlot: row.parent_slot ?? undefined,
    nameValue: row.name_value ?? undefined,
    genderValue: row.gender_value ?? undefined,
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
    death_date_value: action.deathDateValue || null,
    target_person_id: action.targetPersonId ?? null,
    parent_slot: action.parentSlot ?? null,
    name_value: action.nameValue ?? null,
    gender_value: action.genderValue ?? null,
    status: action.status,
  }
}

// If a person had no spouse before and this is their only one, they're
// unambiguously each existing child's other parent — fill in whichever
// parent slot is still empty on those children. Skipped for anyone with
// more than one spouse, since which marriage a child belongs to would be a
// guess at that point.
async function autoFillChildrenOtherParent(people: Record<string, Person>, parentId: string, spouseId: string) {
  const parent = people[parentId]
  if (!parent || parent.spouseIds.length !== 0) return
  const children = Object.values(people).filter((p) => p.motherId === parentId || p.fatherId === parentId)
  for (const child of children) {
    if (child.motherId === parentId && !child.fatherId) {
      await supabase.from('people').update({ father_id: spouseId }).eq('id', child.id)
    } else if (child.fatherId === parentId && !child.motherId) {
      await supabase.from('people').update({ mother_id: spouseId }).eq('id', child.id)
    }
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
  if (action.type === 'edit-deathdate') {
    await supabase.from('people').update({ death_date: action.deathDateValue || null }).eq('id', action.anchorPersonId)
    return
  }
  if (action.type === 'edit-name') {
    if (!action.nameValue?.trim()) return
    await supabase.from('people').update({ name: action.nameValue.trim() }).eq('id', action.anchorPersonId)
    return
  }
  if (action.type === 'edit-gender') {
    if (!action.genderValue) return
    await supabase.from('people').update({ gender: action.genderValue }).eq('id', action.anchorPersonId)
    return
  }
  if (action.type === 'claim-person') {
    // Not a `people` write at all — links the proposing user's own profile
    // to the person they say they are. profiles isn't on the realtime
    // publication, so the claiming user's own currentUser.personId would
    // otherwise stay stale until an unrelated refresh happened to fire.
    await supabase.from('profiles').update({ person_id: action.targetPersonId ?? null }).eq('username', action.createdBy)
    await useAuthStore.getState().refreshUsers()
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
    await autoFillChildrenOtherParent(people, action.anchorPersonId, targetId)
    await autoFillChildrenOtherParent(people, targetId, action.anchorPersonId)
    return
  }
  if (action.type === 'link-parent') {
    const targetId = action.targetPersonId
    const slot = action.parentSlot
    if (!targetId || !slot || !people[targetId] || targetId === action.anchorPersonId) return
    if (slot === 'mother' && anchor.motherId) return
    if (slot === 'father' && anchor.fatherId) return
    const column = slot === 'mother' ? 'mother_id' : 'father_id'
    await supabase.from('people').update({ [column]: targetId }).eq('id', action.anchorPersonId)
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
      await autoFillChildrenOtherParent(people, action.anchorPersonId, newId)
      break
    }
    case 'add-sibling': {
      const shared = action.sharedParent ?? 'both'
      const anchorUpdates: Record<string, string> = {}
      let motherId: string | null = null
      let fatherId: string | null = null

      // Siblinghood is never stored directly — it's derived purely from a
      // shared motherId/fatherId. If the anchor has no recorded parent on the
      // shared side yet, the new sibling would get null there too, and two
      // nulls never count as "shared" — so a placeholder parent is created
      // for both of them to point to, keeping the relation real going forward.
      if (shared === 'mother' || shared === 'both') {
        motherId = anchor.motherId
        if (!motherId) {
          motherId = nanoid(8)
          await supabase
            .from('people')
            .insert(personToInsertRow(motherId, { name: 'Bilinmeyen', gender: 'K', motherId: null, fatherId: null, spouseIds: [], note: '' }))
          anchorUpdates.mother_id = motherId
        }
      }
      if (shared === 'father' || shared === 'both') {
        fatherId = anchor.fatherId
        if (!fatherId) {
          fatherId = nanoid(8)
          await supabase
            .from('people')
            .insert(personToInsertRow(fatherId, { name: 'Bilinmeyen', gender: 'E', motherId: null, fatherId: null, spouseIds: [], note: '' }))
          anchorUpdates.father_id = fatherId
        }
      }

      if (Object.keys(anchorUpdates).length > 0) {
        await supabase.from('people').update(anchorUpdates).eq('id', action.anchorPersonId)
      }
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
  reset: () => void
  select: (id: string | null) => void
  submitAction: (input: {
    type: PendingActionType
    anchorPersonId: string
    newPerson?: Omit<Person, 'id'>
    sharedParent?: 'mother' | 'father' | 'both'
    otherParentId?: string | null
    noteValue?: string
    birthDateValue?: string
    deathDateValue?: string
    targetPersonId?: string
    parentSlot?: 'mother' | 'father'
    nameValue?: string
    genderValue?: Gender
    createdBy: string
    autoApprove: boolean
  }) => Promise<void>
  approveAction: (actionId: string) => Promise<void>
  rejectAction: (actionId: string) => Promise<void>
  addRootPerson: (person: Omit<Person, 'id'>) => Promise<string>
  updatePerson: (id: string, patch: Partial<Person>) => Promise<void>
  deletePerson: (id: string) => Promise<void>
}

let peopleChannel: ReturnType<typeof supabase.channel> | null = null
let pendingChannel: ReturnType<typeof supabase.channel> | null = null

export const useFamilyStore = create<FamilyStore>((set, get) => ({
  people: {},
  pending: [],
  selectedPersonId: null,
  ready: false,
  initialized: false,

  // Different users can see different data through people_visible (an
  // unapproved viewer's masked columns vs. an admin's full view) — without
  // this, logging out of one account and into another within the same tab
  // would keep serving whatever the *previous* session had already fetched,
  // since init() only ever runs its fetch once per page load otherwise.
  reset: () => {
    if (peopleChannel) supabase.removeChannel(peopleChannel)
    if (pendingChannel) supabase.removeChannel(pendingChannel)
    peopleChannel = null
    pendingChannel = null
    set({ people: {}, pending: [], selectedPersonId: null, ready: false, initialized: false })
  },

  init: () => {
    if (get().initialized) return
    set({ initialized: true })

    Promise.all([
      supabase.from('people_visible').select('*'),
      supabase.from('pending_actions').select('*'),
    ]).then(([peopleRes, pendingRes]) => {
      const people: Record<string, Person> = {}
      for (const row of (peopleRes.data as PersonRow[] | null) ?? []) people[row.id] = rowToPerson(row)
      const pending = ((pendingRes.data as PendingRow[] | null) ?? []).map(rowToPending)
      set({ people, pending, ready: true })
    })

    peopleChannel = supabase
      .channel('people-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, (payload) => {
        set((state) => {
          const people = { ...state.people }
          if (payload.eventType === 'DELETE') delete people[(payload.old as PersonRow).id]
          else people[(payload.new as PersonRow).id] = rowToPerson(maskIfNeeded(payload.new as PersonRow))
          return { people }
        })
      })
      .subscribe()

    pendingChannel = supabase
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

  addRootPerson: async (person) => {
    const id = nanoid(8)
    await supabase.from('people').insert(personToInsertRow(id, person))
    return id
  },

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
      deathDateValue: input.deathDateValue,
      targetPersonId: input.targetPersonId,
      parentSlot: input.parentSlot,
      nameValue: input.nameValue,
      genderValue: input.genderValue,
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
    if (patch.deathDate !== undefined) row.death_date = patch.deathDate || null
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
