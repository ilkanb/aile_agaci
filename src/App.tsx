import { useRef } from 'react'
import { FamilyMap, type FamilyMapHandle } from './components/FamilyMap'
import { MapControls } from './components/MapControls'
import { SearchBox } from './components/SearchBox'
import { AdminBar } from './components/AdminBar'
import { ActionPanel } from './components/ActionPanel'
import { LoginScreen } from './components/LoginScreen'
import { useFamilyStore } from './store/familyStore'
import { useAuthStore, canApprove } from './store/authStore'

function App() {
  const currentUser = useAuthStore((s) => s.currentUser())

  const people = useFamilyStore((s) => s.people)
  const selectedPersonId = useFamilyStore((s) => s.selectedPersonId)
  const select = useFamilyStore((s) => s.select)

  const mapRef = useRef<FamilyMapHandle>(null)

  function focusPerson(id: string) {
    select(id)
    mapRef.current?.focusOn(id)
  }

  if (!currentUser) return <LoginScreen />

  const selectedPerson = selectedPersonId ? people[selectedPersonId] : null

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <FamilyMap ref={mapRef} people={people} selectedId={selectedPersonId} onSelect={focusPerson} />

      <div className="top-bar">
        <div className="brand">Aile Ağacı</div>
        <SearchBox people={people} onPick={focusPerson} />
        <AdminBar />
      </div>

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
          onClose={() => select(null)}
          onDeleted={() => select(null)}
        />
      )}
    </div>
  )
}

export default App
