/**
 * Cakrawala gunung di kepala halaman: semua gunung yang dipantau, urut dari
 * barat ke timur, tinggi berskala, dan mana yang sedang punya peringatan abu.
 *
 * Statusnya diambil dari data yang sudah ada di tangan, tanpa unduhan
 * tambahan: gunung terpilih dari peringatan yang menyebut namanya, gunung lain
 * dari daftar peringatan abu nasional di feed SIGMET yang sama.
 */
import type { VolcanoRef } from '../types'
import type { AviationStateId } from './aviation.ts'

export type RidgeAsh = 'ada' | 'tidak' | 'tak terbaca'

export interface RidgeItem {
  id: string
  name: string
  shortName: string
  elevationM: number
  ash: RidgeAsh
}

/**
 * Mulai jumlah ini, cakrawala bisa digeser dan setiap gunung mendapat lebar
 * tetap yang cukup untuk namanya. Di bawahnya, semua muat tanpa digeser.
 */
export const RIDGE_SCROLL_FROM = 6

const tokens = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

/** Kata umum di depan nama gunung; tidak cukup untuk menunjuk satu gunung. */
const PREFIXES = new Set(['ANAK', 'ILI', 'GUNUNG'])

/**
 * Apakah satu nama dari daftar SIGMET nasional menunjuk gunung ini.
 *
 * Penerbit SIGMET menulis nama pendek ("KRAKATAU", "LEWOTOLOK"), registri app
 * menulis nama lengkap ("Anak Krakatau", "Ili Lewotolok"). Cocok bila setiap
 * kata khas di nama SIGMET ada di nama registri. Kata awalan umum tidak
 * dihitung, jadi "ANAK" saja tidak pernah menunjuk Anak Krakatau.
 */
export function namesSameVolcano(registryName: string, sigmetName: string): boolean {
  const have = new Set(tokens(registryName))
  const want = tokens(sigmetName).filter((t) => !PREFIXES.has(t))
  return want.length > 0 && want.every((t) => have.has(t))
}

/** Nama yang muat di bawah kerucut: awalan umum dibuang, kata pertama sisanya. */
export function shortName(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const rest = words.filter((w) => !PREFIXES.has(w.toUpperCase()))
  return (rest[0] ?? words[0] ?? name).replace(/-.*$/, '')
}

function selectedAsh(state: AviationStateId): RidgeAsh {
  if (state === 'unknown') return 'tak terbaca'
  return state === 'active' ? 'ada' : 'tidak'
}

export function ridgeItems(params: {
  volcanoes: VolcanoRef[]
  selectedId: string
  selectedAviation: AviationStateId
  national: { volcanoes: string[] } | null
}): RidgeItem[] {
  const { national } = params
  return params.volcanoes
    .slice()
    .sort((a, b) => a.lon - b.lon)
    .map((v) => {
      const named = national
        ? national.volcanoes.some((n) => namesSameVolcano(v.name, n))
        : null
      let ash: RidgeAsh
      if (v.id === params.selectedId) {
        const own = selectedAsh(params.selectedAviation)
        // Daftar nasional dan peringatan yang menyebut nama berasal dari feed
        // yang sama; bila salah satunya bilang ada, berarti ada.
        ash = own === 'ada' || named === true ? 'ada' : own
      } else {
        ash = named === null ? 'tak terbaca' : named ? 'ada' : 'tidak'
      }
      return {
        id: v.id,
        name: v.name,
        shortName: shortName(v.name),
        elevationM: v.elevationM,
        ash,
      }
    })
}

export interface RidgeSummary {
  total: number
  withAsh: number
  /** Ada gunung yang statusnya tidak bisa dibaca. */
  incomplete: boolean
}

export function ridgeSummary(items: RidgeItem[]): RidgeSummary {
  return {
    total: items.length,
    withAsh: items.filter((i) => i.ash === 'ada').length,
    incomplete: items.some((i) => i.ash === 'tak terbaca'),
  }
}
