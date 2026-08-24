interface Props {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

export function MapControls({ onZoomIn, onZoomOut, onFit }: Props) {
  return (
    <div className="map-controls">
      <button className="ghost-btn" onClick={onZoomIn}>+</button>
      <button className="ghost-btn" onClick={onZoomOut}>−</button>
      <button className="ghost-btn" onClick={onFit}>Sığdır</button>
    </div>
  )
}
