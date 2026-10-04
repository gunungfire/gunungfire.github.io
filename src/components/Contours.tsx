import { contourRings } from '../lib/contours'

/**
 * Motifnya satu dan tetap, jadi dihitung sekali saat modul dimuat — bukan
 * setiap kali kartu digambar ulang tiap lima detik.
 */
const RINGS = contourRings({
  rings: 9,
  cx: 100,
  cy: 100,
  minR: 9,
  maxR: 98,
  seed: 1883, // tahun letusan besar Krakatau; benihnya harus sesuatu
})

/**
 * Tekstur kontur di belakang isi kartu. Warnanya mengikuti `color` induknya
 * lewat currentColor, jadi tetap lewat token dan ikut berganti bersama tema
 * maupun keadaan peringatan.
 */
export function Contours({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`contours ${className}`.trim()}
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor">
        {RINGS.map((r, i) => (
          // Cincin terdalam sedikit lebih tebal, seperti kontur indeks.
          <path key={i} d={r.d} strokeWidth={i % 4 === 0 ? 1.4 : 0.8} />
        ))}
      </g>
    </svg>
  )
}
