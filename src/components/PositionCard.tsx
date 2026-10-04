import type { GeolocationState } from '../hooks/useGeolocation'
import {
  bearingDeg,
  distanceKm,
  fixQuality,
  isDownwind,
  nearestTo,
  zoneVerdict,
} from '../lib/geo'
import { formatDecimal, formatTime } from '../lib/format'
import type {
  AshfallReport,
  ShelterPoint,
  SnapshotProvenance,
  VolcanoRef,
  VolcanoLevel,
} from '../types'
import { SampleTag } from './SampleTag'

interface Props {
  geo: GeolocationState
  volcano: VolcanoRef
  level: VolcanoLevel
  ashfall: AshfallReport
  shelters: ShelterPoint[]
  provenance: SnapshotProvenance
  onShowShelters: () => void
  onShowMap: () => void
}

// Token, bukan kode warna: kuning "di batas" #facc15 hanya 1,3:1 di atas
// putih, jadi vonis paling genting justru tak terbaca di tema terang.
const SAFE = 'var(--c-safe)'
const EDGE = 'var(--c-watch)'
const DANGER = 'var(--c-danger)'

/** Ajakan dan penjelasan singkat untuk keadaan yang belum menghasilkan posisi. */
function Prompt({
  title,
  note,
  action,
  onAction,
}: {
  title: string
  note: string
  action?: string
  onAction?: () => void
}) {
  const body = (
    <>
      <span className="poscard__ontitle">{title}</span>
      <span className="poscard__onnote">{note}</span>
    </>
  )
  if (!action || !onAction) {
    return <section className="poscard poscard--off poscard--static">{body}</section>
  }
  return (
    <button type="button" className="poscard poscard--off" onClick={onAction}>
      {body}
      <span className="poscard__oncta">{action}</span>
    </button>
  )
}

export function PositionCard({
  geo,
  volcano,
  level,
  ashfall,
  shelters,
  provenance,
  onShowShelters,
  onShowMap,
}: Props) {
  const { status, fix } = geo

  if (!fix) {
    switch (status) {
      case 'prompting':
        return (
          <Prompt
            title="Mencari posisi Anda…"
            note="Izinkan akses lokasi saat browser bertanya. Di dalam ruangan, pencarian sinyal bisa memakan waktu belasan detik."
          />
        )
      case 'denied':
        return (
          <Prompt
            title="Izin lokasi ditolak"
            note="App tidak bisa membukanya sendiri. Buka setelan situs di browser Anda, izinkan Lokasi, lalu muat ulang halaman ini."
          />
        )
      case 'insecure':
        return (
          <Prompt
            title="Lokasi butuh koneksi aman"
            note="Halaman ini sedang dibuka tanpa HTTPS, dan browser hanya memberikan lokasi pada koneksi aman."
          />
        )
      case 'unsupported':
        return (
          <Prompt
            title="Browser ini tidak mendukung lokasi"
            note="Anda tetap bisa memakai radius bahaya dan daftar titik kumpul secara manual."
          />
        )
      case 'unavailable':
      case 'timeout':
        return (
          <Prompt
            title={
              status === 'timeout'
                ? 'Pencarian posisi kelamaan'
                : 'Posisi belum bisa dibaca'
            }
            note="Sinyal GPS sering hilang di dalam ruangan atau saat cuaca buruk. Coba lagi di tempat terbuka."
            action="Coba lagi"
            onAction={geo.request}
          />
        )
      default:
        return (
          <Prompt
            title="Aktifkan lokasi"
            note="Supaya app bisa menghitung jarak Anda ke kawah, apakah Anda di dalam radius bahaya, dan titik kumpul mana yang terdekat. Lokasi diproses di perangkat Anda dan tidak dikirim ke mana pun."
            action="Aktifkan"
            onAction={geo.request}
          />
        )
    }
  }

  const km = distanceKm(fix, volcano)
  const verdict = zoneVerdict(km, level.radiusKm, fix.accuracyM)
  const quality = fixQuality(fix.accuracyM)
  const color =
    verdict === 'di dalam' ? DANGER : verdict === 'di batas' ? EDGE : SAFE

  const bearing = bearingDeg(volcano, fix)
  const downwind =
    ashfall.ashHeadingDeg === null
      ? null
      : isDownwind(bearing, ashfall.ashHeadingDeg)

  const nearest = nearestTo(fix, shelters)
  const stale = status !== 'active'

  return (
    <section className="poscard">
      <div className="poscard__head">
        <h2 className="poscard__label">Posisi Anda</h2>
        <button type="button" className="poscard__toggle" onClick={geo.stop}>
          matikan lokasi
        </button>
      </div>

      <div className="poscard__distrow">
        <div className="poscard__km mono" style={{ color }}>
          {km < 10 ? formatDecimal(km) : Math.round(km)} km
        </div>
        <div className="poscard__from">dari kawah</div>
      </div>

      <div className="poscard__verdict" style={{ color }}>
        {verdict === 'di dalam' && 'Anda di dalam zona terlarang'}
        {verdict === 'di luar' && `Di luar zona terlarang ${level.radiusKm} km`}
        {verdict === 'di batas' &&
          `Tepat di sekitar batas ${level.radiusKm} km — anggap Anda di dalam`}
        {provenance.level === 'sample' && <SampleTag title="Radius mengikuti level status yang belum tersambung ke PVMBG" />}
      </div>

      <p className="poscard__note">
        {verdict === 'di luar'
          ? 'Jarak dihitung dari koordinat kawah dan posisi GPS Anda.'
          : 'Segera menjauh dari kawah dan ikuti arahan petugas.'}
        {downwind === true &&
          ` Anda berada di arah sebaran abu (${ashfall.windDirection.toLowerCase()}) — siapkan masker.`}
        {downwind === false && ' Anda tidak berada di jalur sebaran abu saat ini.'}
      </p>

      {nearest && (
        <p className="poscard__note poscard__note--shelter">
          Titik kumpul terdekat: {nearest.place.name},{' '}
          {formatDecimal(nearest.distanceKm)} km garis lurus
          <SampleTag title="Titik kumpul belum tersambung ke data BPBD" />
        </p>
      )}

      <div className="poscard__actions">
        <button
          type="button"
          className="btn-primary"
          style={{
            // Teks hampir putih di atas selubung putih dulu tak terlihat sama
            // sekali di tema terang. Token membuatnya ikut berganti.
            background: verdict === 'di luar' ? 'var(--c-line)' : DANGER,
            color: verdict === 'di luar' ? 'var(--c-text)' : 'var(--c-on-accent)',
          }}
          onClick={onShowShelters}
        >
          {verdict === 'di luar' ? 'Lihat titik kumpul' : 'Rute keluar zona'}
        </button>
        <button type="button" className="btn-ghost" onClick={onShowMap}>
          Peta
        </button>
      </div>

      <div className="poscard__gps">
        GPS akurasi {Math.round(fix.accuracyM)} m ({quality}) ·{' '}
        {formatTime(fix.atISO)}
        {quality !== 'baik' &&
          ' · posisi masih kasar, jangan dipakai menilai batas zona'}
        {stale && ' · pembaruan posisi terhenti'}
      </div>
    </section>
  )
}
