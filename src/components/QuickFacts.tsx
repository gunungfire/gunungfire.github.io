import { memo } from 'react'
import type { AqiBand } from '../data/aqi'
import type { GeoStatus } from '../hooks/useGeolocation'
import { formatNumber } from '../lib/format'
import type { ZoneVerdict } from '../lib/geo'

interface Props {
  /** Jarak dari kawah; null tanpa GPS. */
  distanceKm: number | null
  verdict: ZoneVerdict | null
  radiusKm: number
  geoStatus: GeoStatus
  onEnableLocation: () => void
  aqi: number | null
  band: AqiBand | null
  onOpenLevel: () => void
}

const VERDICT_COLOR: Record<ZoneVerdict, string> = {
  'di dalam': 'var(--c-danger)',
  'di batas': 'var(--c-watch)',
  'di luar': 'var(--c-safe)',
}

/** Kenapa lokasi belum ada, dengan kata yang bisa ditindaklanjuti. */
function locationNote(status: GeoStatus): string | null {
  switch (status) {
    case 'denied':
      return 'Izin ditolak'
    case 'unsupported':
    case 'insecure':
      return 'Tidak didukung'
    case 'prompting':
      return 'Menunggu izin…'
    case 'unavailable':
    case 'timeout':
      return 'Belum dapat sinyal'
    default:
      return null
  }
}

/**
 * Tiga angka di bawah penampang: seberapa dekat Anda, udaranya bagaimana, dan
 * level resmi. Satu baris, tiga sel, tanpa kartu.
 */
export const QuickFacts = memo(function QuickFacts({
  distanceKm,
  verdict,
  radiusKm,
  geoStatus,
  onEnableLocation,
  aqi,
  band,
  onOpenLevel,
}: Props) {
  const note = locationNote(geoStatus)
  const canAsk = geoStatus !== 'unsupported' && geoStatus !== 'insecure' && geoStatus !== 'prompting'

  return (
    <section className="qfacts" aria-label="Tiga angka utama">
      <div className="qfact">
        <span className="qfact__k">Jarak</span>
        {distanceKm === null ? (
          <>
            <span className="qfact__v qfact__v--none">—</span>
            {canAsk && geoStatus !== 'denied' ? (
              <button type="button" className="qfact__act" onClick={onEnableLocation}>
                Aktifkan lokasi
              </button>
            ) : (
              <span className="qfact__n">{note ?? 'Lokasi mati'}</span>
            )}
          </>
        ) : (
          <>
            <span className="qfact__v" style={verdict ? { color: VERDICT_COLOR[verdict] } : undefined}>
              {distanceKm < 10
                ? formatNumber(Math.round(distanceKm * 10) / 10)
                : formatNumber(Math.round(distanceKm))}
              <small>km</small>
            </span>
            <span className="qfact__n">
              {verdict === 'di dalam'
                ? `Dalam radius ${radiusKm} km`
                : verdict === 'di batas'
                  ? `Di batas ${radiusKm} km`
                  : `Di luar ${radiusKm} km`}
            </span>
          </>
        )}
      </div>

      <div className="qfact">
        <span className="qfact__k">Udara</span>
        <span className="qfact__v" style={band ? { color: band.color } : undefined}>
          {aqi === null ? '—' : aqi}
        </span>
        <span className="qfact__n">{band ? band.label : 'Belum terbaca'}</span>
      </div>

      <button type="button" className="qfact qfact--tap" onClick={onOpenLevel}>
        <span className="qfact__k">Level</span>
        <span className="qfact__v qfact__v--none">—</span>
        <span className="qfact__n">Belum resmi</span>
      </button>
    </section>
  )
})
