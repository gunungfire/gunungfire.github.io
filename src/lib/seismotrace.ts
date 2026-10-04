/**
 * Jejak seismogram dari hitungan gempa per jam.
 *
 * Bukan rekaman getaran sungguhan — app ini tidak punya rekaman seismograf,
 * hanya jumlah kejadian per jam dari katalog EMSC/USGS. Jadi bentuknya dibuat
 * jujur terhadap data itu: satu ledakan gelombang per jam, tingginya sebanding
 * dengan jumlah kejadian di jam tersebut, dan garis benar-benar datar di jam
 * yang tidak mencatat apa pun. Tidak ada getaran latar karangan untuk membuat
 * jam sepi terlihat hidup.
 */

/** Bentuk satu ledakan: posisi dalam slot jam dan tinggi relatif puncaknya. */
const BURST: Array<[number, number]> = [
  [0.18, 1],
  [0.34, -0.72],
  [0.5, 0.46],
  [0.66, -0.24],
  [0.82, 0],
]

/** Jam dengan satu kejadian pun tetap terlihat, walau puncak hari itu ratusan. */
const MIN_AMP = 1.5

export interface Trace {
  d: string
  baseline: number
  /** Simpangan terbesar yang digambar, dalam piksel. */
  peak: number
}

export function seismotrace(hourly: number[], w: number, h: number): Trace {
  const baseline = h / 2
  const room = baseline - 1
  const n = Math.max(1, hourly.length)
  const slot = w / n
  // Dibersihkan dulu sebelum mencari puncak: Math.max dengan satu NaN saja
  // bernilai NaN, dan satu jam berdata rusak akan merusak seluruh jejak.
  const counts = hourly.map((raw) => (Number.isFinite(raw) && raw > 0 ? raw : 0))
  const max = Math.max(0, ...counts)
  let d = `M0 ${baseline.toFixed(1)}`
  let peak = 0

  counts.forEach((count, i) => {
    const x0 = i * slot
    if (count === 0 || max === 0) {
      d += `L${(x0 + slot).toFixed(1)} ${baseline.toFixed(1)}`
      return
    }
    const amp = Math.max(MIN_AMP, (count / max) * room)
    peak = Math.max(peak, amp)
    for (const [fx, fy] of BURST) {
      const x = x0 + fx * slot
      const y = baseline - fy * amp
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    d += `L${(x0 + slot).toFixed(1)} ${baseline.toFixed(1)}`
  })

  return { d, baseline, peak }
}
