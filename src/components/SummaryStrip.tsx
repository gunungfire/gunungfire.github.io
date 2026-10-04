import { aqiBand } from '../data/aqi'
import type { AviationStatus } from '../data/aviation'
import type { GeolocationState } from '../hooks/useGeolocation'
import { distanceKm } from '../lib/geo'
import { SEVERITY_COLOR } from '../theme'
import type { VolcanoSnapshot } from '../types'
import { SampleTag } from './SampleTag'
import { Seismotrace } from './Seismotrace'

interface Props {
  snapshot: VolcanoSnapshot
  aviation: AviationStatus
  geo: GeolocationState
  onGoMap: () => void
  onGoAviation: () => void
}

interface Tile {
  key: string
  label: string
  value: string
  unit: string | null
  color: string | undefined
  sample?: boolean
  extra?: React.ReactNode
  onClick?: () => void
}

/**
 * Empat angka teratas, tepat di bawah kepala halaman.
 *
 * Sebelumnya keempatnya tersebar sepanjang hampir tiga ribu piksel, jadi
 * pertanyaan paling dasar — seberapa dekat saya, udaranya bagaimana, ada
 * peringatan tidak, gempanya banyak tidak — baru terjawab setelah menggulir
 * jauh. Yang di sini hanya memindahkan angka yang sudah ada ke atas; tidak ada
 * angka baru dan tidak ada yang dihitung ulang.
 */
export function SummaryStrip({
  snapshot,
  aviation,
  geo,
  onGoMap,
  onGoAviation,
}: Props) {
  const km = geo.fix
    ? distanceKm({ lat: geo.fix.lat, lon: geo.fix.lon }, snapshot.volcano)
    : null
  const aqi = snapshot.air?.aqi ?? null
  const band = aqi === null ? null : aqiBand(aqi)
  const quakes24 = snapshot.seismicHourly.reduce((a, b) => a + b, 0)
  // Tanpa katalog gempa, deret per jamnya adalah data contoh. Dulu jumlahnya
  // tetap tampil di sini sebagai "356 di sekitar gunung" tanpa penanda apa
  // pun — angka karangan yang terbaca seperti pengamatan.
  const seismicSample = snapshot.provenance.seismic === 'sample'

  const advisoryCount = snapshot.ashAdvisories?.filter(
    (a) => a.namedHere && a.validity !== 'lewat',
  ).length

  const tiles: Tile[] = [
    {
      key: 'jarak',
      label: 'Jarak Anda',
      value: km === null ? '—' : km < 10 ? km.toFixed(1) : `${Math.round(km)}`,
      unit: km === null ? 'lokasi mati' : 'km ke kawah',
      color: km === null ? undefined : SEVERITY_COLOR.safe,
      onClick: km === null ? undefined : onGoMap,
    },
    {
      key: 'abu',
      label: 'Peringatan abu',
      value:
        advisoryCount === undefined
          ? '—'
          : advisoryCount > 0
            ? String(advisoryCount)
            : 'Nihil',
      unit:
        advisoryCount === undefined
          ? 'belum terbaca'
          : advisoryCount > 0
            ? 'menyebut gunung ini'
            : 'tidak ada yang aktif',
      color: aviation.colors.color,
      onClick: onGoAviation,
    },
    {
      key: 'udara',
      label: 'Kualitas udara',
      value: aqi === null ? '—' : String(aqi),
      unit: band?.label ?? 'belum terbaca',
      color: band?.color,
    },
    {
      key: 'gempa',
      label: 'Gempa 24 jam',
      value: String(quakes24),
      unit: seismicSample ? 'belum tersambung' : 'di sekitar gunung',
      color: undefined,
      sample: seismicSample,
      extra: (
        <Seismotrace hourly={snapshot.seismicHourly} sample={seismicSample} />
      ),
    },
  ]

  return (
    <section className="sumstrip" aria-label="Ringkasan keadaan">
      {tiles.map((t) => {
        // Garis kanal di tepi kiri mengikuti warna keadaan angkanya; angka yang
        // belum terbaca tidak diberi warna apa pun.
        const style = t.color
          ? ({ '--ch': t.color } as React.CSSProperties)
          : undefined
        const body = (
          <>
            <span className="sumtile__k">{t.label}</span>
            <span className="sumtile__v" style={{ color: t.color }}>
              {t.value}
              {t.sample && <SampleTag />}
            </span>
            <span className="sumtile__u">{t.unit}</span>
            {t.extra}
          </>
        )
        return t.onClick ? (
          <button
            key={t.key}
            type="button"
            className="sumtile sumtile--tap"
            style={style}
            onClick={t.onClick}
          >
            {body}
          </button>
        ) : (
          <div className="sumtile" key={t.key} style={style}>
            {body}
          </div>
        )
      })}
    </section>
  )
}
