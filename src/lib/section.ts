/**
 * Penampang tegak sepanjang satu garis di peta, dari kawah (A) ke B.
 *
 * Peta menjawab "di mana", penampang menjawab "seberapa tinggi": gunung, awan
 * abu menurut peringatan penerbangan, dan posisi Anda di tanah. Keduanya
 * memakai garis yang sama, jadi yang digambar di sini selalu bisa dicocokkan
 * dengan garis biru di peta.
 *
 * Semua yang berskala dihitung di sini dan diuji: arah garis, jarak, tinggi
 * gunung, ketinggian dan bentangan awan abu. Yang tidak berskala hanya bentuk
 * kerucutnya — app ini tidak punya profil topografi — dan itu dinyatakan di
 * layar.
 */
import {
  bearingDeg,
  destinationPoint,
  distanceKm,
  pointInPolygon,
  type LatLon,
} from './geo.ts'

/** Dari mana arah garis penampang diambil. */
export type SectionBasis = 'gps' | 'angin' | 'tetap'

/** Bentang terpendek: cukup untuk radius pembanding dan cincin 30 km di peta. */
export const MIN_SPAN_KM = 30

/**
 * Lebih jauh dari ini, pengguna ada di daerah lain dan gunungnya akan tergambar
 * setipis rambut. Penampang tetap 30 km dan pengguna ditandai di luar gambar.
 */
export const MAX_DRAWN_USER_KM = 100

/** Tanpa GPS dan tanpa data angin, garis ditarik ke timur — dan dikatakan begitu. */
export const FALLBACK_BEARING_DEG = 90

const NICE_SPANS = [30, 40, 50, 60, 80, 100, 120]

export interface SectionLine {
  basis: SectionBasis
  bearingDeg: number
  /** Jarak pengguna dari kawah; null tanpa GPS. */
  userKm: number | null
  /** Panjang sumbu mendatar penampang. */
  spanKm: number
  /** Ujung B di peta: posisi pengguna, atau ujung bentang ke arah garis. */
  end: LatLon
  /** Pengguna terlalu jauh untuk berdiri di dalam gambar. */
  userOffScale: boolean
}

function niceSpan(km: number): number {
  return NICE_SPANS.find((s) => s >= km) ?? NICE_SPANS[NICE_SPANS.length - 1]
}

export function sectionLine(
  vent: LatLon,
  fix: LatLon | null,
  ashHeadingDeg: number | null,
): SectionLine {
  if (fix) {
    const userKm = distanceKm(vent, fix)
    const bearing = bearingDeg(vent, fix)
    if (userKm > MAX_DRAWN_USER_KM) {
      return {
        basis: 'gps',
        bearingDeg: bearing,
        userKm,
        spanKm: MIN_SPAN_KM,
        end: destinationPoint(vent, bearing, MIN_SPAN_KM),
        userOffScale: true,
      }
    }
    // Sedikit ruang di belakang pengguna supaya sosoknya tidak menempel di tepi.
    return {
      basis: 'gps',
      bearingDeg: bearing,
      userKm,
      spanKm: niceSpan(Math.max(MIN_SPAN_KM, userKm * 1.15)),
      end: fix,
      userOffScale: false,
    }
  }
  const basis: SectionBasis = ashHeadingDeg === null ? 'tetap' : 'angin'
  const bearing = ashHeadingDeg ?? FALLBACK_BEARING_DEG
  return {
    basis,
    bearingDeg: bearing,
    userKm: null,
    spanKm: MIN_SPAN_KM,
    end: destinationPoint(vent, bearing, MIN_SPAN_KM),
    userOffScale: false,
  }
}

/** Ketinggian penampang terendah: FL250 masih muat, gunung tertinggi pun. */
export const MIN_ALT_KM = 8
/** Batas atas supaya awan abu yang sangat tinggi tidak memipihkan gunungnya. */
export const MAX_ALT_KM = 16

export interface SectionScale {
  altKm: number
  /** Piksel per km mendatar dan tegak. */
  pxX: number
  pxY: number
  /** Berapa kali skala tegak dilebihkan, dibulatkan, minimal 1. */
  exaggeration: number
  /** Posisi kawah di sumbu mendatar, dalam piksel. */
  x0: number
}

export function sectionScale(params: {
  spanKm: number
  ashTopKm: number | null
  width: number
  groundY: number
  /** Ruang di kiri kawah untuk lereng sebelah sana, dalam piksel. */
  leftPx: number
  rightPx: number
}): SectionScale {
  const wanted = params.ashTopKm === null ? 0 : Math.ceil(params.ashTopKm + 1)
  const altKm = Math.min(MAX_ALT_KM, Math.max(MIN_ALT_KM, wanted))
  const pxX = (params.width - params.leftPx - params.rightPx) / params.spanKm
  const pxY = params.groundY / altKm
  return {
    altKm,
    pxX,
    pxY,
    exaggeration: Math.max(1, Math.round(pxY / pxX)),
    x0: params.leftPx,
  }
}

/** Tanda jarak di sumbu mendatar, kelipatan rapi sampai ujung bentang. */
export function kmTicks(spanKm: number): number[] {
  const step = spanKm <= 30 ? 10 : spanKm <= 60 ? 20 : spanKm <= 100 ? 25 : 40
  const ticks: number[] = []
  for (let km = step; km <= spanKm + 1e-9; km += step) ticks.push(km)
  return ticks
}

const KM_PER_FL = 0.03048

/** Garis flight level yang muat di penampang, dengan tingginya dalam km. */
export function flightLevels(altKm: number): { fl: number; km: number }[] {
  const out: { fl: number; km: number }[] = []
  for (let fl = 100; fl * KM_PER_FL < altKm - 0.4; fl += 100) {
    out.push({ fl, km: fl * KM_PER_FL })
  }
  return out
}

/**
 * Tinggi permukaan kerucut skematis pada jarak tertentu dari kawah.
 *
 * Satu-satunya bagian penampang yang bukan ukuran: kakinya ditaksir dari tinggi
 * puncak, dan lerengnya cekung seperti gunung api strato pada umumnya. Dipakai
 * juga untuk menegakkan sosok pengguna di atas lereng, bukan di dalamnya.
 */
export function coneAltitudeKm(distKm: number, summitKm: number): number {
  const foot = coneFootKm(summitKm)
  const d = Math.abs(distKm)
  if (d >= foot) return 0
  const t = 1 - d / foot
  return summitKm * t * t
}

export function coneFootKm(summitKm: number): number {
  return Math.min(8, Math.max(2.5, summitKm * 2.2))
}

export interface AshSpan {
  /** Bentangan di sepanjang garis; negatif berarti di belakang kawah. */
  fromKm: number
  toKm: number
  baseKm: number
  topKm: number
}

const SAMPLE_KM = 0.5
const FT_TO_KM = 0.0003048

/**
 * Bagian garis penampang yang benar-benar berada di dalam area peringatan abu.
 *
 * Dihitung dari poligon resmi SIGMET, bukan dikarang: garis dicuplik tiap
 * setengah km dan setiap cuplikan diuji di dalam poligon atau tidak. Peringatan
 * tanpa poligon atau tanpa puncak tidak bisa digambar ke skala, jadi dilewati.
 */
export function ashAlongSection(params: {
  vent: LatLon
  bearingDeg: number
  spanKm: number
  /** Seberapa jauh di belakang kawah ikut diperiksa. */
  behindKm: number
  advisory: {
    polygon: [number, number][] | null
    topM: number | null
    baseFt: number | null
  }
}): AshSpan[] {
  const { polygon, topM, baseFt } = params.advisory
  if (!polygon || polygon.length < 3 || topM === null) return []
  const topKm = topM / 1000
  const baseKm = baseFt === null ? 0 : baseFt * FT_TO_KM

  const spans: AshSpan[] = []
  let open: number | null = null
  let last = -params.behindKm
  for (let d = -params.behindKm; d <= params.spanKm + 1e-9; d += SAMPLE_KM) {
    const p =
      d >= 0
        ? destinationPoint(params.vent, params.bearingDeg, d)
        : destinationPoint(params.vent, (params.bearingDeg + 180) % 360, -d)
    const inside = pointInPolygon(p, polygon)
    if (inside && open === null) open = d
    if (!inside && open !== null) {
      spans.push({ fromKm: open, toKm: last, baseKm, topKm })
      open = null
    }
    last = d
  }
  if (open !== null) spans.push({ fromKm: open, toKm: last, baseKm, topKm })
  return spans
}
