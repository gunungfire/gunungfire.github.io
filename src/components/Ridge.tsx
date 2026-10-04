import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RIDGE_SCROLL_FROM, ridgeSummary, type RidgeItem } from '../data/ridge'
import { formatNumber } from '../lib/format'
import { GLYPH_BASE_Y, GLYPH_H, GLYPH_W, ridgeGlyph } from '../lib/ridgeGlyph'

interface Props {
  items: RidgeItem[]
  selectedId: string
  onSelect: (id: string) => void
}

const ASH_TEXT: Record<RidgeItem['ash'], string> = {
  ada: 'ada peringatan abu',
  tidak: 'tanpa peringatan abu',
  'tak terbaca': 'status abu tak terbaca',
}

function summaryText(items: RidgeItem[]): string {
  const s = ridgeSummary(items)
  if (s.withAsh === 0 && s.incomplete) return 'Status abu nasional tak terbaca.'
  // Pendek, karena berbagi baris dengan penghitung tepi di layar 320 px.
  if (s.withAsh === 0) return `Peringatan abu: tidak ada di ${s.total} gunung.`
  return `Peringatan abu: ${s.withAsh} dari ${s.total} gunung.`
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Semua gunung yang dipantau dalam satu garis, barat ke timur, tinggi
 * berskala. Gunung yang punya peringatan abu mengepulkan asap.
 *
 * Mulai enam gunung, setiap gunung mendapat lebar tetap dengan nama di
 * bawahnya dan barisnya bisa digeser. Gunung berabu yang tergeser keluar layar
 * dihitung di tepi, jadi peringatan tidak bisa tersembunyi hanya karena
 * letaknya.
 */
export const Ridge = memo(function Ridge({ items, selectedId, onSelect }: Props) {
  const scroll = items.length >= RIDGE_SCROLL_FROM
  const listRef = useRef<HTMLOListElement | null>(null)
  const rafRef = useRef(0)
  const firstRef = useRef(true)
  const [edges, setEdges] = useState({ left: 0, right: 0 })
  const maxM = Math.max(1, ...items.map((i) => i.elevationM))

  const measureEdges = useCallback(() => {
    rafRef.current = 0
    const list = listRef.current
    if (!list || !scroll) return
    const from = list.scrollLeft
    const to = from + list.clientWidth
    let left = 0
    let right = 0
    Array.from(list.children).forEach((li, i) => {
      if (items[i]?.ash !== 'ada') return
      const el = li as HTMLElement
      const mid = el.offsetLeft + el.offsetWidth / 2
      if (mid < from) left += 1
      else if (mid > to) right += 1
    })
    // State hanya berubah bila hitungannya berubah, bukan tiap piksel gulir.
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [items, scroll])

  const onScroll = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(measureEdges)
  }, [measureEdges])

  // Gunung terpilih digeser ke tengah. Pertama kali tanpa animasi, supaya
  // halaman tidak terlihat bergerak sendiri saat dibuka.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !scroll) return
    const idx = items.findIndex((i) => i.id === selectedId)
    const li = list.children[idx] as HTMLElement | undefined
    if (!li) return
    const target = li.offsetLeft + li.offsetWidth / 2 - list.clientWidth / 2
    list.scrollTo({
      left: Math.max(0, target),
      behavior: firstRef.current || prefersReducedMotion() ? 'auto' : 'smooth',
    })
    firstRef.current = false
    measureEdges()
  }, [selectedId, items, scroll, measureEdges])

  useEffect(() => {
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [onScroll])

  return (
    <div className={`ridge${scroll ? ' ridge--scroll' : ''}`}>
      <div className="ridge__track">
        <ol
          className="ridge__list"
          ref={listRef}
          onScroll={scroll ? onScroll : undefined}
          style={scroll ? undefined : { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
          aria-label="Gunung yang dipantau, urut dari barat ke timur"
        >
          {items.map((v) => {
            const glyph = ridgeGlyph(v.elevationM, maxM)
            const selected = v.id === selectedId
            return (
              <li key={v.id} className="ridge__item">
                <button
                  type="button"
                  className={`ridge__v ridge__v--${v.ash === 'ada' ? 'abu' : v.ash === 'tidak' ? 'bersih' : 'tak'}`}
                  aria-pressed={selected}
                  aria-label={`${v.name}, ${formatNumber(v.elevationM)} m, ${ASH_TEXT[v.ash]}`}
                  onClick={() => onSelect(v.id)}
                >
                  <svg
                    className="ridge__svg"
                    viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`}
                    aria-hidden="true"
                    focusable="false"
                  >
                    {v.ash === 'ada' && <path className="ridge__puff" d={glyph.puff} />}
                    <path className="ridge__cone" d={glyph.cone} />
                    <line className="ridge__ground" x1="0" x2={GLYPH_W} y1={GLYPH_BASE_Y} y2={GLYPH_BASE_Y} />
                  </svg>
                  {scroll && <span className="ridge__n">{v.shortName}</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </div>
      {/* Penghitung tepi duduk di baris ringkasan, bukan di atas baris gunung:
          di atasnya ia menutupi kepulan gunung yang terpotong di tepi. */}
      <div className="ridge__foot">
        {scroll && edges.left > 0 && (
          <span className="ridge__edge" aria-hidden="true">
            ← {edges.left} abu
          </span>
        )}
        <p className="ridge__sum">{summaryText(items)}</p>
        {scroll && edges.right > 0 && (
          <span className="ridge__edge" aria-hidden="true">
            {edges.right} abu →
          </span>
        )}
      </div>
    </div>
  )
})
