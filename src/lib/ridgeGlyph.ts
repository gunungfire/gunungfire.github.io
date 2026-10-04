/**
 * Ikon satu gunung di cakrawala: kerucut berskala tinggi dan, bila ada
 * peringatan abu, kepulan di atas puncaknya.
 *
 * Kotaknya sengaja dipatok: daftar yang bisa digeser memotong apa pun yang
 * keluar dari kotak ikon, jadi puncak tertinggi beserta kepulannya harus
 * tetap di dalam — dulu kepulan Semeru menembus tepi atas dan terpotong.
 */

export const GLYPH_W = 64
export const GLYPH_H = 48
/** Garis tanah. */
export const GLYPH_BASE_Y = 44
/** Tinggi kepulan dari puncak, termasuk celah satu satuan di atas kawah. */
export const PUFF_H = 15
/** Ruang kosong di atas kepulan tertinggi. */
const TOP_ROOM = 2
/** Tinggi kerucut gunung tertinggi; yang lain berskala terhadapnya. */
export const GLYPH_PEAK = GLYPH_BASE_Y - PUFF_H - TOP_ROOM
/** Gunung serendah apa pun tetap terlihat sebagai tonjolan. */
const MIN_H = 1.5

export interface RidgeGlyph {
  cone: string
  puff: string
  /** Puncak kerucut dalam satuan viewBox. */
  topY: number
}

const r = (n: number) => Math.round(n * 10) / 10

export function ridgeGlyph(elevationM: number, maxElevationM: number): RidgeGlyph {
  const ratio = maxElevationM > 0 ? Math.min(1, Math.max(0, elevationM / maxElevationM)) : 0
  const h = Math.max(MIN_H, ratio * GLYPH_PEAK)
  const half = 9 + h * 0.35
  const top = GLYPH_BASE_Y - h
  const mid = GLYPH_W / 2
  const cone =
    `M${r(mid - half)} ${GLYPH_BASE_Y} ` +
    `Q${r(mid - half * 0.35)} ${r(GLYPH_BASE_Y - h * 0.25)} ${mid - 1.5} ${r(top)} ` +
    `L${mid + 1.5} ${r(top)} ` +
    `Q${r(mid + half * 0.35)} ${r(GLYPH_BASE_Y - h * 0.25)} ${r(mid + half)} ${GLYPH_BASE_Y}Z`
  const puff =
    `M${mid} ${r(top - 1)} ` +
    `C${mid - 2} ${r(top - 6)} ${mid - 9} ${r(top - 7)} ${mid - 8} ${r(top - 11)} ` +
    `C${mid - 7} ${r(top - PUFF_H)} ${mid + 5} ${r(top - PUFF_H)} ${mid + 6} ${r(top - 11)} ` +
    `C${mid + 7} ${r(top - 7)} ${mid + 2} ${r(top - 6)} ${mid} ${r(top - 1)}Z`
  return { cone, puff, topY: r(top) }
}
