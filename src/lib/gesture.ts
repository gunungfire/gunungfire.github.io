/**
 * Hitungan murni di balik gestur lembar geser: tanpa DOM, supaya bisa diuji
 * dan supaya komponennya tinggal memasang hasilnya.
 */

export type Axis = 'x' | 'y'

/** Jarak minimum sebelum sumbu gerakan diputuskan. */
export const AXIS_SLOP_PX = 8
/** Kecepatan lepas (px/ms) yang dihitung sebagai lemparan, bukan tarikan. */
export const FLICK_PX_PER_MS = 0.4
/** Lemparan sekuat ini boleh melompati jepret tengah. */
export const STRONG_FLICK_PX_PER_MS = 2.5
/** Seberapa jauh ke depan dorongan jari diproyeksikan saat dilepas. */
const PROJECT_MS = 160
/** Lemparan mendatar minimum untuk berpindah tab. */
const SWIPE_FLICK_PX_PER_MS = 0.35
const SWIPE_MIN_PX = 30
/** Sejauh ini (bagian dari lebar) berpindah tab tanpa perlu dilempar. */
const SWIPE_DISTANCE = 0.25

/**
 * Sumbu diputuskan sekali, begitu jari bergeser cukup jauh. Mendatar harus
 * jelas lebih dominan: gerakan miring hampir selalu niat menggulir.
 */
export function lockAxis(dx: number, dy: number, slop = AXIS_SLOP_PX): Axis | null {
  if (Math.hypot(dx, dy) < slop) return null
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
}

/**
 * Melewati batas terasa makin berat dan tidak pernah lebih dari `limit` —
 * bukan berhenti mendadak seperti tembok.
 */
export function rubberBand(value: number, min: number, max: number, limit = 80): number {
  const resist = (over: number) => limit * (1 - 1 / ((over / limit) * 0.55 + 1))
  if (value < min) return min - resist(min - value)
  if (value > max) return max + resist(value - max)
  return value
}

export interface Sample {
  /** Waktu, ms. */
  t: number
  v: number
}

/**
 * Kecepatan (satuan per ms) dari sampel di jendela terakhir. Jari yang sudah
 * diam sebelum dilepas berkecepatan nol, berapa pun cepatnya tadi.
 */
export function velocity(samples: readonly Sample[], now: number, windowMs = 90): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  if (now - last.t > windowMs) return 0
  let first = last
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break
    first = samples[i]
  }
  const dt = last.t - first.t
  return dt > 0 ? (last.v - first.v) / dt : 0
}

/**
 * Posisi jepret setelah dilepas. `snaps` naik dari rendah ke tinggi; `v`
 * positif berarti lembar sedang membesar.
 *
 * Tarikan pelan berhenti di jepret terdekat. Lemparan berpindah tepat satu
 * jepret ke arahnya — dorongan cepat tidak boleh memantul kembali, tapi juga
 * tidak boleh melompati jepret tengah tanpa sengaja. Hanya lemparan yang
 * sangat kuat diproyeksikan ke depan dan boleh melompat.
 */
export function pickSnap(snaps: readonly number[], position: number, v: number): number {
  const nearest = (at: number) => {
    let best = 0
    snaps.forEach((s, i) => {
      if (Math.abs(s - at) < Math.abs(snaps[best] - at)) best = i
    })
    return best
  }
  if (Math.abs(v) < FLICK_PX_PER_MS) return nearest(position + v * PROJECT_MS)

  let step = -1
  if (v > 0) step = snaps.findIndex((s) => s > position + 1)
  else snaps.forEach((s, i) => {
    if (s < position - 1) step = i
  })
  if (step === -1) return v > 0 ? snaps.length - 1 : 0
  if (Math.abs(v) >= STRONG_FLICK_PX_PER_MS) {
    const far = nearest(position + v * PROJECT_MS)
    if (v > 0 ? far > step : far < step) return far
  }
  return step
}

export interface DragResult {
  height: number
  scrollTop: number
}

/**
 * Tinggi lembar selama ditarik. Ditarik melewati tinggi penuh dari dalam
 * isinya (`handoff`), sisa tarikan diteruskan menggulir isi — satu gerakan
 * membuka lembar lalu terus membaca. Dari gagang, melewati batas hanya lentur.
 */
export function dragHeight(
  snaps: readonly number[],
  startHeight: number,
  dy: number,
  startScroll: number,
  handoff: boolean,
): DragResult {
  const low = snaps[0]
  const full = snaps[snaps.length - 1]
  const want = startHeight - dy
  if (want > full && handoff) return { height: full, scrollTop: startScroll + (want - full) }
  return { height: rubberBand(want, low, full, want > full ? 24 : 60), scrollTop: startScroll }
}

/**
 * Langkah tab dari geseran mendatar: 1 ke tab berikutnya (jari ke kiri),
 * -1 ke sebelumnya, 0 tetap. Cukup jauh, atau cukup cepat ke arah yang sama.
 */
export function swipeStep(dx: number, vx: number, width: number): -1 | 0 | 1 {
  const far = Math.abs(dx) >= width * SWIPE_DISTANCE
  const flung =
    Math.abs(vx) >= SWIPE_FLICK_PX_PER_MS &&
    Math.abs(dx) >= SWIPE_MIN_PX &&
    Math.sign(vx) === Math.sign(dx)
  if (!far && !flung) return 0
  return dx < 0 ? 1 : -1
}
