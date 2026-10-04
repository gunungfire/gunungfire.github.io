import { seismotrace } from '../lib/seismotrace'

const W = 240
const H = 34

interface Props {
  hourly: number[]
  /** Data contoh, bukan dari katalog: digambar putus-putus dan redup. */
  sample: boolean
}

/**
 * Jejak gempa per jam bergaya seismogram. Lihat lib/seismotrace.ts untuk
 * kenapa bentuknya begini: satu ledakan per jam, tinggi sebanding jumlah
 * kejadian, datar bila nol.
 */
export function Seismotrace({ hourly, sample }: Props) {
  const t = seismotrace(hourly, W, H)
  const total = hourly.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0)
  const busiest = Math.max(0, ...hourly.filter((v) => Number.isFinite(v)))
  const label = sample
    ? 'Jejak gempa per jam, data contoh — belum tersambung ke katalog gempa'
    : total === 0
      ? `Jejak gempa per jam, ${hourly.length} jam terakhir: tidak ada kejadian tercatat`
      : `Jejak gempa per jam, ${hourly.length} jam terakhir: ${total} kejadian, terbanyak ${busiest} dalam satu jam`
  return (
    <svg
      className={`strace${sample ? ' strace--sample' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <line
        className="strace__base"
        x1="0"
        x2={W}
        y1={t.baseline}
        y2={t.baseline}
      />
      <path className="strace__line" d={t.d} />
    </svg>
  )
}
