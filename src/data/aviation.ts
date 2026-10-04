import type { AshAdvisory, ColorSet } from '../types'

/**
 * Kartu utama v4 memakai bahasa penerbangan. Aviation colour code resmi
 * (GREEN/YELLOW/ORANGE/RED) dikeluarkan observatorium gunung api — di Indonesia
 * lewat VONA Badan Geologi — dan belum tersambung ke app ini.
 *
 * Jadi yang ditampilkan bukan kode itu, melainkan satu hal yang memang bisa
 * dibaca dari sumber terbuka: ada atau tidaknya peringatan abu penerbangan
 * (SIGMET) yang berlaku untuk wilayah gunung ini. Menyebutnya "colour code"
 * padahal diturunkan sendiri akan membuat angka karangan terlihat resmi.
 */
export type AviationStateId = 'unknown' | 'clear' | 'nearby' | 'active'

export interface AviationStatus {
  id: AviationStateId
  /** Kata besar di kartu, sengaja bukan nama warna resmi. */
  name: string
  /**
   * Jawaban satu-dua kata di layar Status, dibaca bersama judulnya "Abu di
   * jalur terbang". Sama seperti `name`, sengaja bukan nama warna resmi.
   */
  verdict: string
  /** Keterangan pendek di samping kata besar. */
  short: string
  /** Apa yang sebenarnya dibaca, satu kalimat. */
  headline: string
  /** Artinya untuk orang yang tinggal di sekitar gunung. */
  plain: string
  /** Judul pendek di layar Panduan. */
  action: string
  /** Naik ke pita peringatan di atas layar bila benar. */
  urgent: boolean
  strip: string
  colors: ColorSet
}

/*
 * Sama seperti di src/theme.ts: warna ditunjuk lewat token supaya nilainya
 * ikut berganti bersama tema. Nama GREEN/YELLOW dipertahankan karena itu
 * keadaan yang diwakilinya, bukan kode warna penerbangan — app ini memang
 * tidak pernah mengeluarkan Aviation Colour Code.
 */
const tone = (token: string, linePct: number, washPct: number): ColorSet => ({
  color: `var(${token})`,
  line: `color-mix(in srgb, var(${token}) ${linePct}%, transparent)`,
  wash: `color-mix(in srgb, var(${token}) ${washPct}%, transparent)`,
})

const GREEN: ColorSet = tone('--c-safe', 30, 6)
const YELLOW: ColorSet = tone('--c-watch', 30, 6)
const ORANGE: ColorSet = tone('--c-alert', 32, 7)
const GREY: ColorSet = tone('--c-neutral', 30, 6)

/**
 * Terjemahkan daftar SIGMET menjadi satu keadaan. `null` berarti sumbernya
 * gagal dimuat — itu keadaan tersendiri, bukan "tidak ada peringatan".
 */
export function resolveAviationStatus(
  all: AshAdvisory[] | null,
  volcanoName: string,
): AviationStatus {
  // Peringatan yang jendelanya sudah lewat bukan lagi peringatan aktif; ikut
  // dihitung berarti layar bisa berteriak karena kabar kemarin.
  const advisories = all === null ? null : all.filter((a) => a.validity !== 'lewat')
  if (advisories === null) {
    return {
      id: 'unknown',
      name: 'BELUM DIKETAHUI',
      verdict: 'Tak terbaca.',
      short: 'sumber tidak terbaca',
      headline:
        'Peringatan abu penerbangan belum bisa dimuat, jadi app ini tidak tahu apakah sedang ada abu di jalur terbang.',
      plain:
        'Jangan menyimpulkan apa pun dari layar ini. Periksa pengumuman Badan Geologi atau hubungi 112.',
      action: 'Cari kabar dari sumber resmi',
      urgent: false,
      strip: '',
      colors: GREY,
    }
  }

  const named = advisories.filter((a) => a.namedHere)
  if (named.length > 0) {
    return {
      id: 'active',
      name: 'ABU AKTIF',
      verdict: 'Ada abu.',
      short: 'peringatan menyebut gunung ini',
      headline: `Otoritas penerbangan mengeluarkan ${named.length === 1 ? 'satu peringatan' : `${named.length} peringatan`} abu vulkanik yang menyebut ${volcanoName}.`,
      plain:
        'Abu sedang berada di jalur terbang. Bila Anda di sekitar gunung, siapkan masker dan ikuti pengumuman resmi sebelum bepergian.',
      action: 'Siapkan masker dan jangan mendekati kawah',
      urgent: true,
      strip: `Peringatan abu vulkanik aktif untuk ${volcanoName}. Ikuti arahan Badan Geologi dan BPBD.`,
      colors: ORANGE,
    }
  }

  if (advisories.length > 0) {
    return {
      id: 'nearby',
      name: 'ABU DI SEKITAR',
      verdict: 'Abu di sekitar.',
      short: 'peringatan tidak menyebut gunung ini',
      headline: `Ada ${advisories.length} peringatan abu vulkanik di wilayah udara sekitar, tetapi tidak satu pun menyebut ${volcanoName}. Bisa jadi milik gunung tetangga.`,
      plain:
        'Belum tentu berhubungan dengan gunung ini. Baca teks peringatannya di Info sebelum mengambil kesimpulan.',
      action: 'Baca teks peringatannya sebelum bertindak',
      urgent: false,
      strip: '',
      colors: YELLOW,
    }
  }

  return {
    id: 'clear',
    name: 'TIDAK ADA ABU',
    verdict: 'Bersih.',
    short: 'tidak ada peringatan aktif',
    headline: `Tidak ada peringatan abu vulkanik aktif untuk wilayah udara ${volcanoName}.`,
    plain:
      'Peringatan ini hanya terbit saat abu mencapai jalur terbang. Tidak adanya peringatan bukan berarti tidak ada erupsi.',
    action: 'Tidak ada pembatasan dari peringatan abu',
    urgent: false,
    strip: '',
    colors: GREEN,
  }
}
