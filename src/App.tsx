import { useEffect, useRef, useState } from 'react'
import { FamilyMap, type FamilyMapHandle } from './components/FamilyMap'
import { MapControls } from './components/MapControls'
import { SearchBox } from './components/SearchBox'
import { AdminBar } from './components/AdminBar'
import { ActionPanel } from './components/ActionPanel'
import { LoginScreen } from './components/LoginScreen'
import { EmptyTreeState } from './components/EmptyTreeState'
import { useFamilyStore } from './store/familyStore'
import { useAuthStore, canApprove } from './store/authStore'

function App() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const authReady = useAuthStore((s) => s.ready)

  const people = useFamilyStore((s) => s.people)
  const familyReady = useFamilyStore((s) => s.ready)
  const selectedPersonId = useFamilyStore((s) => s.selectedPersonId)
  const select = useFamilyStore((s) => s.select)

  const [egoFocalId, setEgoFocalId] = useState<string | null>(null)

  const mapRef = useRef<FamilyMapHandle>(null)

  useEffect(() => {
    useAuthStore.getState().init()
  }, [])

  useEffect(() => {
    if (currentUser) useFamilyStore.getState().init()
    else useFamilyStore.getState().reset()
  }, [currentUser])

  function focusPerson(id: string) {
    select(id)
    mapRef.current?.focusOn(id)
  }

  if (!authReady) return null
  if (!currentUser) return <LoginScreen />
  if (!familyReady) return null

  if (Object.keys(people).length === 0) {
    if (!canApprove(currentUser)) {
      return (
        <div className="login-screen">
          <div className="login-card">
            <div className="brand" style={{ marginBottom: 8 }}>Ağaç henüz boş</div>
            <div className="login-hint">Bir yöneticiden ilk kişiyi eklemesini iste.</div>
          </div>
        </div>
      )
    }
    return <EmptyTreeState onCreated={focusPerson} />
  }

  const selectedPerson = selectedPersonId ? people[selectedPersonId] : null
  const egoFocalPerson = egoFocalId ? people[egoFocalId] : null

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <FamilyMap
        ref={mapRef}
        people={people}
        selectedId={selectedPersonId}
        onSelect={focusPerson}
        egoFocalId={egoFocalId}
      />

      <div className="top-bar">
        <div className="brand">Aile Ağacı</div>
        <SearchBox people={people} onPick={focusPerson} />
        {egoFocalPerson && (
          <button className="ghost-btn" onClick={() => setEgoFocalId(null)}>
            Tüm Ağacı Göster
          </button>
        )}
        <AdminBar />
      </div>

      {egoFocalPerson && (
        <div className="ego-banner">Merkez: {egoFocalPerson.name}</div>
      )}

      <MapControls
        onZoomIn={() => mapRef.current?.zoomBy(1.4)}
        onZoomOut={() => mapRef.current?.zoomBy(1 / 1.4)}
        onFit={() => mapRef.current?.fit()}
      />

      {selectedPerson && (
        <ActionPanel
          key={selectedPerson.id}
          person={selectedPerson}
          people={people}
          username={currentUser.id}
          canApprove={canApprove(currentUser)}
          approved={currentUser.approved}
          myPersonId={currentUser.personId}
          onClose={() => select(null)}
          onDeleted={() => select(null)}
          onCenterOn={(id) => setEgoFocalId(id)}
        />
      )}
    </div>
  )
}

export default App
