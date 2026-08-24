import { useState } from 'react'
import type { Gender, Person, PendingActionType } from '../types'
import { getParents, getSpouses } from '../lib/family'
import { useFamilyStore } from '../store/familyStore'
import { RelationFinder } from './RelationFinder'
import { LinkSpouse } from './LinkSpouse'

interface Props {
  person: Person
  people: Record<string, Person>
  username: string
  canApprove: boolean
  onClose: () => void
  onDeleted: () => void
  onCenterOn: (id: string) => void
}

type FormKind = PendingActionType | null

const ACTION_LABELS: Record<PendingActionType, string> = {
  'add-mother': 'Anne ekle',
  'add-father': 'Baba ekle',
  'add-sibling': 'Kardeş ekle',
  'add-spouse': 'Eş ekle',
  'add-child': 'Çocuk ekle',
  'edit-note': 'Not güncelle',
  'edit-birthdate': 'Doğum tarihi güncelle',
  'link-spouse': 'Mevcut kişiyle eşleştir',
}

function formatBirthDate(value?: string): string {
  if (!value) return 'Doğum tarihi eklemek için tıkla...'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function ActionPanel({ person, people, username, canApprove, onClose, onDeleted, onCenterOn }: Props) {
  const submitAction = useFamilyStore((s) => s.submitAction)
  const deletePerson = useFamilyStore((s) => s.deletePerson)

  const [formKind, setFormKind] = useState<FormKind>(null)
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('?')
  const [note, setNote] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [sharedParent, setSharedParent] = useState<'mother' | 'father' | 'both'>('both')
  const [otherParentId, setOtherParentId] = useState<string>('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(person.note)
  const [editingBirthDate, setEditingBirthDate] = useState(false)
  const [birthDateDraft, setBirthDateDraft] = useState(person.birthDate ?? '')

  const parents = getParents(person, people)
  const spouses = getSpouses(person, people)
  const hasMother = Boolean(person.motherId)
  const hasFather = Boolean(person.fatherId)

  function resetForm() {
    setFormKind(null)
    setName('')
    setGender('?')
    setNote('')
    setBirthDate('')
    setSharedParent('both')
    setOtherParentId('')
  }

  function submit() {
    if (!formKind || !name.trim()) return
    submitAction({
      type: formKind,
      anchorPersonId: person.id,
      newPerson: {
        name: name.trim(),
        gender,
        motherId: null,
        fatherId: null,
        spouseIds: [],
        note,
        birthDate: birthDate || undefined,
      },
      sharedParent: formKind === 'add-sibling' ? sharedParent : undefined,
      otherParentId: formKind === 'add-child' ? (otherParentId || null) : undefined,
      createdBy: username,
      autoApprove: canApprove,
    })
    resetForm()
  }

  function saveNote() {
    submitAction({
      type: 'edit-note',
      anchorPersonId: person.id,
      noteValue: noteDraft,
      createdBy: username,
      autoApprove: canApprove,
    })
    setEditingNote(false)
  }

  function saveBirthDate() {
    submitAction({
      type: 'edit-birthdate',
      anchorPersonId: person.id,
      birthDateValue: birthDateDraft,
      createdBy: username,
      autoApprove: canApprove,
    })
    setEditingBirthDate(false)
  }

  return (
    <div className="action-panel">
      <div className="action-panel-header">
        <div>
          <div className="action-panel-name">{person.name}</div>
          <div className="action-panel-meta">
            {parents.length > 0 && <span>Ebeveyn: {parents.map((p) => p.name).join(', ')}</span>}
            {spouses.length > 0 && <span> · Eş: {spouses.map((p) => p.name).join(', ')}</span>}
          </div>
        </div>
        <button className="ghost-btn" onClick={onClose}>Kapat</button>
      </div>

      <button className="ghost-btn center-on-btn" onClick={() => onCenterOn(person.id)}>
        ◎ Merkeze Al
      </button>

      {editingNote ? (
        <div className="note-row">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Not (örn. Almanya'da yaşıyor)"
          />
          <button className="primary-btn" onClick={saveNote}>
            {canApprove ? 'Kaydet' : 'Onaya gönder'}
          </button>
        </div>
      ) : (
        <div className="note-display" onClick={() => setEditingNote(true)}>
          {person.note || 'Not eklemek için tıkla...'}
        </div>
      )}

      {editingBirthDate ? (
        <div className="note-row">
          <input type="date" value={birthDateDraft} onChange={(e) => setBirthDateDraft(e.target.value)} />
          <button className="primary-btn" onClick={saveBirthDate}>
            {canApprove ? 'Kaydet' : 'Onaya gönder'}
          </button>
        </div>
      ) : (
        <div className="note-display" onClick={() => setEditingBirthDate(true)}>
          {formatBirthDate(person.birthDate)}
        </div>
      )}

      <div className="action-buttons">
        {!hasMother && (
          <button className="ghost-btn" onClick={() => setFormKind('add-mother')}>+ Anne</button>
        )}
        {!hasFather && (
          <button className="ghost-btn" onClick={() => setFormKind('add-father')}>+ Baba</button>
        )}
        <button className="ghost-btn" onClick={() => setFormKind('add-sibling')}>+ Kardeş</button>
        <button className="ghost-btn" onClick={() => setFormKind('add-spouse')}>+ Eş</button>
        <button className="ghost-btn" onClick={() => setFormKind('add-child')}>+ Çocuk</button>
        <LinkSpouse person={person} people={people} username={username} canApprove={canApprove} />
        <RelationFinder person={person} people={people} />
        {canApprove && (
          <button
            className="danger-btn"
            onClick={() => {
              if (confirm(`${person.name} silinsin mi?`)) {
                deletePerson(person.id)
                onDeleted()
              }
            }}
          >
            Sil
          </button>
        )}
      </div>

      {formKind && (
        <div className="form-card">
          <div className="form-title">{ACTION_LABELS[formKind]}</div>
          <input placeholder="İsim" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="?">Cinsiyet bilinmiyor</option>
            <option value="K">Kadın</option>
            <option value="E">Erkek</option>
          </select>
          <input placeholder="Not (opsiyonel)" value={note} onChange={(e) => setNote(e.target.value)} />
          <label className="field-label">
            Doğum tarihi (opsiyonel)
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>

          {formKind === 'add-sibling' && (
            <select value={sharedParent} onChange={(e) => setSharedParent(e.target.value as 'mother' | 'father' | 'both')}>
              <option value="both">Öz kardeş (anne ve baba ortak)</option>
              <option value="mother">Üvey kardeş (sadece anne ortak)</option>
              <option value="father">Üvey kardeş (sadece baba ortak)</option>
            </select>
          )}

          {formKind === 'add-child' && spouses.length > 0 && (
            <select value={otherParentId} onChange={(e) => setOtherParentId(e.target.value)}>
              <option value="">Diğer ebeveyn seçilmedi</option>
              {spouses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          <div className="form-actions">
            <button className="ghost-btn" onClick={resetForm}>Vazgeç</button>
            <button className="primary-btn" onClick={submit} disabled={!name.trim()}>
              {canApprove ? 'Ekle' : 'Onaya gönder'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
