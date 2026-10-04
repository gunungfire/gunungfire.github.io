/**
 * Garis kontur topografi untuk hiasan kartu.
 *
 * Bentuknya sengaja tidak diambil dari gunung mana pun, dan sengaja sama untuk
 * ketujuh gunung. App ini menolak bentuk karangan di peta karena peta terbaca
 * sebagai hasil pengukuran; kontur yang berganti mengikuti gunung terpilih akan
 * terbaca sebagai "inilah bentuk Sinabung", padahal bukan. Yang ini satu motif
 * tetap, tanpa skala, tanpa label, terpotong di sudut kartu — tekstur, bukan
 * data.
 *
 * Tiap cincin memakai fungsi gangguan yang sama, hanya diskalakan. Karena itu
 * cincin luar selalu berada di luar cincin dalam di setiap sudut: garis kontur
 * sungguhan tidak pernah bersilangan, dan yang ini pun tidak.
 */

export interface ContourOptions {
  rings: number
  cx: number
  cy: number
  minR: number
  maxR: number
  seed: number
  /** Titik per cincin; makin banyak makin halus. */
  points?: number
}

/** Pembangkit acak berbenih: hasilnya sama setiap kali, jadi motifnya tetap. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface ContourRing {
  d: string
  /** Jari-jari terkecil dan terbesar cincin ini, untuk diuji. */
  radii: number[]
}

export function contourRings(o: ContourOptions): ContourRing[] {
  const n = o.points ?? 72
  const rand = mulberry32(o.seed)
  // Tiga harmonik dengan amplitudo menurun: cukup untuk bentuk yang terasa
  // alami, tanpa lekuk tajam yang tidak dimiliki lereng sungguhan.
  const harmonics = [2, 3, 5].map((k, i) => ({
    k,
    amp: 0.11 / (i + 1),
    phase: rand() * Math.PI * 2,
  }))
  const f = (theta: number) =>
    harmonics.reduce((s, h) => s + h.amp * Math.sin(h.k * theta + h.phase), 0)

  const rings: ContourRing[] = []
  for (let r = 0; r < o.rings; r++) {
    const R = o.rings === 1 ? o.minR : o.minR + ((o.maxR - o.minR) * r) / (o.rings - 1)
    const radii: number[] = []
    let d = ''
    for (let i = 0; i < n; i++) {
      const theta = (i / n) * Math.PI * 2
      const rho = R * (1 + f(theta))
      radii.push(rho)
      const x = o.cx + rho * Math.cos(theta)
      const y = o.cy + rho * Math.sin(theta)
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    }
    rings.push({ d: `${d}Z`, radii })
  }
  return rings
}
