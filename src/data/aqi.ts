/**
 * Indeks kualitas udara dari PM2.5, memakai tabel breakpoint US EPA (revisi
 * 2024). Rumusnya publik dan deterministik, jadi angkanya bisa ditelusuri
 * kembali ke konsentrasi aslinya — bukan angka karangan.
 *
 * Satu batasan yang harus selalu ikut ditampilkan: EPA mendefinisikan indeks
 * ini di atas rata-rata 24 jam, sedangkan yang kita punya adalah pembacaan
 * model per jam. Jadi hasilnya perkiraan cepat, bukan indeks resmi.
 */

interface Breakpoint {
  cLo: number
  cHi: number
  iLo: number
  iHi: number
}

/** Tabel PM2.5 (µg/m³) → AQI, US EPA 2024. */
const PM25_BREAKPOINTS: Breakpoint[] = [
  { cLo: 0.0, cHi: 9.0, iLo: 0, iHi: 50 },
  { cLo: 9.1, cHi: 35.4, iLo: 51, iHi: 100 },
  { cLo: 35.5, cHi: 55.4, iLo: 101, iHi: 150 },
  { cLo: 55.5, cHi: 125.4, iLo: 151, iHi: 200 },
  { cLo: 125.5, cHi: 225.4, iLo: 201, iHi: 300 },
  { cLo: 225.5, cHi: 325.4, iLo: 301, iHi: 500 },
]

export interface AqiBand {
  /** Batas atas indeks untuk kategori ini. */
  max: number
  label: string
  /**
   * Selalu token, bukan kode warna. Kuning #facc15 yang jelas di atas latar
   * gelap hanya 1,3:1 di atas putih — angka "Sedang" pernah tak terbaca sama
   * sekali di tema terang karena berkas ini terlewat saat warna dipindah ke
   * token.
   */
  color: string
  advice: string
}

export const AQI_BANDS: AqiBand[] = [
  {
    max: 50,
    label: 'Baik',
    color: 'var(--c-safe)',
    advice:
      'Udara aman. Tidak perlu pembatasan aktivitas di luar ruangan.',
  },
  {
    max: 100,
    label: 'Sedang',
    color: 'var(--c-watch)',
    advice:
      'Kelompok sensitif sebaiknya mengurangi aktivitas berat di luar ruangan.',
  },
  {
    max: 150,
    label: 'Tidak sehat bagi kelompok sensitif',
    color: 'var(--c-alert)',
    advice:
      'Anak, lansia, dan penderita asma sebaiknya di dalam ruangan. Pakai masker bila keluar.',
  },
  {
    max: 200,
    label: 'Tidak sehat',
    color: 'var(--c-danger)',
    advice:
      'Kurangi aktivitas di luar ruangan. Pakai masker N95 dan tutup ventilasi rumah.',
  },
  {
    max: 300,
    label: 'Sangat tidak sehat',
    color: 'var(--c-severe)',
    advice:
      'Tetap di dalam ruangan. Abu vulkanik pada tingkat ini merusak saluran napas.',
  },
  {
    max: 500,
    label: 'Berbahaya',
    color: 'var(--c-hazard)',
    advice:
      'Seluruh warga berisiko. Jangan keluar rumah kecuali untuk mengungsi, dan pakai masker N95.',
  },
]

/**
 * Ubah konsentrasi PM2.5 menjadi indeks AQI. Nilai di luar tabel dikembalikan
 * null, bukan dipaksakan ke ujung skala — indeks yang tidak terdefinisi lebih
 * baik hilang daripada tampil sebagai 500 yang seolah terukur.
 */
export function aqiFromPm25(pm25: number): number | null {
  if (!Number.isFinite(pm25) || pm25 < 0) return null
  // EPA memotong konsentrasi ke satu desimal sebelum menghitung.
  const c = Math.floor(pm25 * 10) / 10
  const band = PM25_BREAKPOINTS.find((b) => c >= b.cLo && c <= b.cHi)
  if (!band) return null
  const ratio = (band.iHi - band.iLo) / (band.cHi - band.cLo)
  return Math.round(ratio * (c - band.cLo) + band.iLo)
}

export function aqiBand(aqi: number): AqiBand {
  return AQI_BANDS.find((b) => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1]
}
