import { useState } from 'react'
import { useFamilyStore } from '../store/familyStore'
import { useAuthStore, canApprove } from '../store/authStore'
import { disambiguatedLabel } from '../lib/family'
import type { Person, PendingAction, Role } from '../types'

const ACTION_TEXT: Record<string, string> = {
  'add-mother': 'anne olarak',
  'add-father': 'baba olarak',
  'add-sibling': 'kardeş olarak',
  'add-spouse': 'eş olarak',
  'add-child': 'çocuk olarak',
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Yönetici (admin)',
  member: 'Üye',
}

const PARENT_SLOT_LABEL = { mother: 'anne', father: 'baba' } as const

function describePendingAction(action: PendingAction, people: Record<string, Person>): string {
  const anchor = people[action.anchorPersonId]
  const target = action.targetPersonId ? people[action.targetPersonId] : undefined
  const anchorLabel = anchor ? disambiguatedLabel(anchor, people) : '?'
  const targetLabel = target ? disambiguatedLabel(target, people) : '?'
  switch (action.type) {
    case 'edit-note':
      return `${anchorLabel} için not güncellemesi: "${action.noteValue}"`
    case 'edit-birthdate':
      return `${anchorLabel} için doğum tarihi güncellemesi: "${action.birthDateValue}"`
    case 'edit-deathdate':
      return `${anchorLabel} için ölüm tarihi güncellemesi: "${action.deathDateValue}"`
    case 'link-spouse':
      return `${anchorLabel} ile ${targetLabel} eşleştirilsin`
    case 'link-parent':
      return `${targetLabel}, ${anchorLabel} için ${PARENT_SLOT_LABEL[action.parentSlot ?? 'mother']} olarak bağlansın`
    case 'edit-name':
      return `${anchorLabel} için isim güncellemesi: "${action.nameValue}"`
    case 'edit-gender':
      return `${anchorLabel} için cinsiyet güncellemesi`
    case 'claim-person':
      return `${action.createdBy}, kendisini ${anchorLabel} olarak işaretlemek istiyor`
    default:
      return `${action.newPerson?.name} — ${anchorLabel} için ${ACTION_TEXT[action.type]}`
  }
}

export function AdminBar() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const users = useAuthStore((s) => s.users)
  const setRole = useAuthStore((s) => s.setRole)
  const approveUser = useAuthStore((s) => s.approveUser)

  const pending = useFamilyStore((s) => s.pending)
  const people = useFamilyStore((s) => s.people)
  const approveAction = useFamilyStore((s) => s.approveAction)
  const rejectAction = useFamilyStore((s) => s.rejectAction)

  const [showPending, setShowPending] = useState(false)
  const [showUsers, setShowUsers] = useState(false)
  const [showUnapproved, setShowUnapproved] = useState(false)

  if (!currentUser) return null
  const userCanApprove = canApprove(currentUser)
  const unapprovedUsers = Object.values(users).filter((u) => !u.approved)

  return (
    <div className="admin-bar">
      <span className="whoami">
        {currentUser.id} · {ROLE_LABEL[currentUser.role]}
      </span>

      {pending.length > 0 && (
        <button className="ghost-btn" onClick={() => setShowPending((v) => !v)}>
          Onay Bekleyenler ({pending.length})
        </button>
      )}

      {currentUser.role === 'admin' && unapprovedUsers.length > 0 && (
        <button className="ghost-btn" onClick={() => setShowUnapproved((v) => !v)}>
          Onay Bekleyen Üyeler ({unapprovedUsers.length})
        </button>
      )}

      {currentUser.role === 'admin' && (
        <button className="ghost-btn" onClick={() => setShowUsers((v) => !v)}>
          Kullanıcılar
        </button>
      )}

      <button className="ghost-btn" onClick={logout}>Çıkış</button>

      {showPending && (
        <div className="popover pending-list">
          {pending.length === 0 && <div>Bekleyen yok</div>}
          {pending.map((action) => {
            const label = describePendingAction(action, people)
            return (
              <div key={action.id} className="pending-item">
                <div>
                  <span>{label}</span>
                  <div className="pending-item-meta">Öneren: {action.createdBy}</div>
                </div>
                {userCanApprove && (
                  <div className="pending-item-actions">
                    <button className="primary-btn" onClick={() => approveAction(action.id)}>Onayla</button>
                    <button className="danger-btn" onClick={() => rejectAction(action.id)}>Reddet</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showUnapproved && currentUser.role === 'admin' && (
        <div className="popover pending-list">
          {unapprovedUsers.length === 0 && <div>Onay bekleyen yok</div>}
          {unapprovedUsers.map((u) => (
            <div key={u.id} className="pending-item">
              <div>
                <strong>{u.id}</strong>
                <div className="pending-item-meta">Kayıt oldu, ağacın sınırlı (isim/soyisim) görünümünü görüyor</div>
              </div>
              <div className="pending-item-actions">
                <button className="primary-btn" onClick={() => approveUser(u.id)}>Onayla</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUsers && currentUser.role === 'admin' && (
        <div className="popover pending-list">
          {Object.values(users).map((u) => (
            <div key={u.id} className="pending-item">
              <div>
                <strong>{u.id}</strong>
                <div className="pending-item-meta">
                  {ROLE_LABEL[u.role]}
                  {!u.approved && ' · onaysız'}
                </div>
              </div>
              {u.id !== currentUser.id && (
                <div className="pending-item-actions">
                  {u.role === 'member' ? (
                    <button className="primary-btn" onClick={() => setRole(u.id, 'admin')}>Admin yap</button>
                  ) : (
                    <button className="ghost-btn" onClick={() => setRole(u.id, 'member')}>Üyeye düşür</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
