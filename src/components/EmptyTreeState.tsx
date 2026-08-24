import { useState } from 'react'
import type { Gender } from '../types'
import { useFamilyStore } from '../store/familyStore'

interface Props {
  onCreated: (id: string) => void
}

export function EmptyTreeState({ onCreated }: Props) {
  const addRootPerson = useFamilyStore((s) => s.addRootPerson)

  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('?')
  const [birthDate, setBirthDate] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    const id = await addRootPerson({
      name: name.trim(),
      gender,
      motherId: null,
      fatherId: null,
      spouseIds: [],
      note: '',
      birthDate: birthDate || undefined,
    })
    setBusy(false)
    onCreated(id)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 8 }}>Ağaç henüz boş</div>
        <div className="login-hint">
          Bu, aile ağacındaki ilk kişi olacak — sonrasında herkesi ona bağlayarak ekleyebilirsin.
        </div>

        <input placeholder="İsim" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          <option value="?">Cinsiyet bilinmiyor</option>
          <option value="K">Kadın</option>
          <option value="E">Erkek</option>
        </select>
        <label className="field-label">
          Doğum tarihi (opsiyonel)
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>

        <button className="primary-btn" onClick={submit} disabled={busy || !name.trim()}>
          İlk kişiyi ekle
        </button>
      </div>
    </div>
  )
}
