import type { MapLayer } from '../types'

interface Props {
  layers: MapLayer[]
  layer: MapLayer['id']
  onLayerChange: (id: MapLayer['id']) => void
  focus: 'gunung' | 'saya'
  onToggleFocus: () => void
  /** Tombol "lihat posisi saya" tidak berguna sebelum GPS memberi titik. */
  canFocusUser: boolean
}

/**
 * Kendali peta yang mengapung di atasnya.
 *
 * Pemilih lapisan dulu ada di bawah peta; sekarang petanya penuh layar, jadi
 * kendalinya ikut naik ke atas peta. Atribusi tidak ditulis ulang di sini —
 * kontrol bawaan Leaflet sudah digeser naik agar tidak tertutup lembar geser,
 * dan dua atribusi di satu layar hanya menambah ramai.
 */
export function MapControls({
  layers,
  layer,
  onLayerChange,
  focus,
  onToggleFocus,
  canFocusUser,
}: Props) {
  return (
    <div className="mapctl" data-sheet-follow>
      <div className="mapctl__group" role="group" aria-label="Lapisan peta">
        {layers.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`mapctl__btn${item.id === layer ? ' mapctl__btn--on' : ''}`}
            aria-pressed={item.id === layer}
            onClick={() => onLayerChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {canFocusUser && (
        <button type="button" className="mapctl__btn" onClick={onToggleFocus}>
          {focus === 'gunung' ? 'Lihat posisi saya' : 'Pusatkan ke gunung'}
        </button>
      )}
    </div>
  )
}
