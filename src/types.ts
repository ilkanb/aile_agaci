export type Gender = 'K' | 'E' | '?'

export interface Person {
  id: string
  name: string
  gender: Gender
  motherId: string | null
  fatherId: string | null
  spouseIds: string[]
  note: string
  // ISO date string (yyyy-mm-dd), optional — enables older/younger sibling wording
  birthDate?: string
  // ISO date string (yyyy-mm-dd), optional
  deathDate?: string
  photoUrl?: string
}

export type PendingActionType =
  | 'add-mother'
  | 'add-father'
  | 'add-sibling'
  | 'add-spouse'
  | 'add-child'
  | 'edit-note'
  | 'edit-birthdate'
  | 'edit-deathdate'
  | 'link-spouse'

export interface PendingAction {
  id: string
  type: PendingActionType
  createdAt: number
  createdBy: string
  // The person the action was initiated from (or, for edit-*/link-* types, the person being edited)
  anchorPersonId: string
  // Data for the new person to create once approved (add-* types only)
  newPerson?: Omit<Person, 'id'>
  // For add-sibling: which parent is shared (mother/father/both)
  sharedParent?: 'mother' | 'father' | 'both'
  // For add-child: which existing spouse is the other parent (if any)
  otherParentId?: string | null
  // For edit-note: the proposed new note text
  noteValue?: string
  // For edit-birthdate: the proposed new birth date (empty string clears it)
  birthDateValue?: string
  // For edit-deathdate: the proposed new death date (empty string clears it)
  deathDateValue?: string
  // For link-spouse: the id of the already-existing person to link as a spouse
  targetPersonId?: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface FamilyState {
  people: Record<string, Person>
  pending: PendingAction[]
}

export type Role = 'admin' | 'member'

export interface User {
  id: string
  passwordHash: string
  role: Role
  createdAt: number
}
