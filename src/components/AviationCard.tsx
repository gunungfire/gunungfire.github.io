import type { AviationStatus } from '../data/aviation'
import type { DataStateView } from '../data/dataState'
import { Contours } from './Contours'
import { Why } from './Why'

interface Props {
  status: AviationStatus
  dataState: DataStateView
  advisoryCount: number | null
  onOpenAviation: () => void
}

/**
 * Kartu utama layar Status. Bentuknya mengikuti kartu aviation colour code di
 * prototipe v4, tetapi isinya sengaja bukan kode resmi itu — lihat alasannya di
 * data/aviation.ts. Catatan "kode resmi belum tersambung" ikut di kartu, bukan
 * di kaki halaman, supaya tidak terlewat.
 */
export function AviationCard({
  status,
  dataState,
  advisoryCount,
  onOpenAviation,
}: Props) {
  return (
    <section className="avcard">
      <Contours className="avcard__contours" />
      <h2 className="avcard__label">Peringatan abu untuk penerbangan</h2>
      <div className="avcard__row">
        <div className="avcard__name">{status.name}</div>
        <div className="avcard__short">{status.short}</div>
      </div>
      <p className="avcard__headline">{status.headline}</p>

      <div className="avcard__plainbox">
        <div className="avcard__plainlabel">Artinya untuk Anda</div>
        <p className="avcard__plain">{status.plain}</p>
      </div>

      <div className="pills">
        <span className="pill mono">
          {advisoryCount === null
            ? 'SIGMET gagal dimuat'
            : `${advisoryCount} peringatan aktif`}
        </span>
        <span className="pill mono">Radius pantau 500 km</span>
      </div>

      <div className="source">
        Sumber: SIGMET otoritas penerbangan via NOAA Aviation Weather Center ·{' '}
        {dataState.sourceTime}
      </div>

      <Why label="Kenapa bukan GREEN / ORANGE / RED?">
        Aviation colour code resmi dikeluarkan observatorium gunung api — di
        Indonesia lewat VONA Badan Geologi — dan belum tersambung ke app ini.
        Menuliskannya dari hasil turunan sendiri akan membuat tebakan terlihat
        resmi. Yang dibaca di atas hanya ada tidaknya peringatan abu di jalur
        terbang.
      </Why>

      <button type="button" className="linkrow" onClick={onOpenAviation}>
        Baca teks peringatannya →
      </button>
    </section>
  )
}
