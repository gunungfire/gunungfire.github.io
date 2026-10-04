/**
 * Kalimat satu baris di setiap bagian tab Info.
 *
 * Tab Info menyimpan semua isi yang dulu tersebar di lima tab, terlipat.
 * Ringkasan inilah yang dibaca orang sebelum memutuskan membuka sebuah bagian,
 * jadi ia tunduk pada aturan yang sama dengan angka di mana pun di app ini:
 * yang belum terbaca dikatakan belum terbaca, bukan nol, dan data contoh
 * dikatakan contoh.
 */
import { aqiBand } from './aqi.ts'
import type { ZoneVerdict } from '../lib/geo.ts'

export type InfoSectionId =
  | 'abu'
  | 'posisi'
  | 'level'
  | 'udara'
  | 'gempa'
  | 'wilayah'
  | 'laporan'
  | 'panduan'

export const INFO_ORDER: InfoSectionId[] = [
  'abu',
  'posisi',
  'udara',
  'gempa',
  'wilayah',
  'level',
  'laporan',
  'panduan',
]

export const INFO_TITLE: Record<InfoSectionId, string> = {
  abu: 'Peringatan abu penerbangan',
  posisi: 'Posisi Anda dan titik kumpul',
  level: 'Level resmi Indonesia',
  udara: 'Kualitas udara dan arah abu',
  gempa: 'Gempa di sekitar',
  wilayah: 'Wilayah dan penduduk',
  laporan: 'Laporan dan kabar resmi',
  panduan: 'Panduan dan nomor darurat',
}

export interface InfoSummaryInput {
  aviationShort: string
  aviationAction: string
  national: { total: number } | null
  position: { km: number; verdict: ZoneVerdict } | null
  radiusKm: number
  aqi: number | null
  windDirection: string
  windSample: boolean
  seismicHourly: number[]
  seismicSample: boolean
  population: { rings: { radiusKm: number; people: number }[] } | null
  feedCount: number
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export function infoSummaries(i: InfoSummaryInput): Record<InfoSectionId, string> {
  const quakes = i.seismicHourly.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0)
  const ring = i.population?.rings.slice().sort((a, b) => a.radiusKm - b.radiusKm)[0] ?? null
  const band = i.aqi === null ? null : aqiBand(i.aqi)
  const km = i.position
    ? i.position.km < 10
      ? fmt(Math.round(i.position.km * 10) / 10)
      : fmt(Math.round(i.position.km))
    : null

  return {
    abu:
      cap(i.aviationShort) +
      (i.national ? ` · ${fmt(i.national.total)} aktif se-Indonesia` : ''),
    posisi: i.position
      ? `${km} km dari kawah, ${i.position.verdict} radius ${i.radiusKm} km`
      : 'Lokasi belum aktif',
    level: 'Belum tersambung ke Badan Geologi',
    udara:
      (band && i.aqi !== null ? `AQI ${i.aqi}, ${band.label.toLowerCase()}` : 'Kualitas udara belum terbaca') +
      ` · abu ke ${i.windDirection.toLowerCase()}${i.windSample ? ' (contoh)' : ''}`,
    gempa: i.seismicSample
      ? 'Belum tersambung ke katalog gempa · contoh'
      : `${fmt(quakes)} kejadian dalam 24 jam`,
    wilayah: ring
      ? `${fmt(ring.people)} jiwa dalam ${ring.radiusKm} km dari kawah`
      : 'Perkiraan penduduk belum terbaca',
    laporan: i.feedCount ? `${fmt(i.feedCount)} kabar terbaru` : 'Belum ada kabar',
    panduan: `${i.aviationAction} · darurat 112`,
  }
}
