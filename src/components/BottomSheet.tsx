import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  dragHeight,
  lockAxis,
  pickSnap,
  rubberBand,
  swipeStep,
  velocity,
  type Sample,
} from '../lib/gesture'

/** Di bawah lebar ini lembar geser menempel di bawah; di atasnya jadi panel kiri. */
export const WIDE_PX = 1000

/**
 * Sisa layar di atas lembar saat dibuka penuh, bila induk belum mengukur
 * kepala halaman.
 */
const DEFAULT_TOP_GAP = 76

/** Jarak tegak minimum sebelum tarikan ke bawah di puncak isi diambil lembar. */
const PULL_SLOP_PX = 3

/** Klik yang menyusul tarikan atau geseran ditelan selama ini. */
const CLICK_GUARD_MS = 350

export interface SheetMetrics {
  /** Tinggi lembar sekarang, dipakai peta untuk menghitung ruang yang tertutup. */
  height: number
  wide: boolean
  /** Lebar panel kiri saat layar lebar; 0 saat lembar menempel di bawah. */
  panelWidth: number
}

interface Props {
  /** Tiga posisi jepret dihitung dari tinggi layar. */
  onMetrics: (m: SheetMetrics) => void
  /**
   * Posisi jepret dipegang induknya supaya berpindah tab bisa ikut membuka
   * lembar — 0 rendah, 1 setengah, 2 penuh.
   */
  snap: number
  onSnapChange: (snap: number) => void
  /** Isi tetap di atas area gulir — navigasi tab. */
  header: ReactNode
  /**
   * Penanda isi yang sedang tampil. Gulir hanya dikembalikan ke atas saat
   * penanda ini berubah — bukan setiap kali induknya menggambar ulang.
   */
  scrollKey: string
  /**
   * Jarak dari atas layar ke tepi atas lembar saat penuh. Diukur dari kepala
   * halaman yang mengapung: dengan angka tetap, kepala yang lebih tinggi —
   * misalnya karena cakrawala gunung — menutupi tab di puncak lembar.
   */
  topGap?: number
  /** Halaman (tab) yang tampil, dan jumlahnya; geser mendatar berpindah halaman. */
  page: number
  pageCount: number
  onPage: (page: number) => void
  children: ReactNode
}

function snapPointsFor(viewportH: number, topGap: number): [number, number, number] {
  const full = viewportH - topGap
  const mid = Math.min(Math.round(viewportH * 0.58), full)
  return [Math.min(348, Math.round(viewportH * 0.44), mid), mid, full]
}

function panelWidthFor(viewportW: number): number {
  return Math.min(420, Math.max(340, Math.round(viewportW * 0.32)))
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Geser mendatar tidak boleh merebut gestur dari elemen yang memang digeser
 * mendatar: seismogram yang disusuri jari, atau teks panjang yang digulir ke
 * samping.
 */
function swipeAllowed(target: Element, stop: Element): boolean {
  if (target.closest('[data-no-swipe]')) return false
  for (let el: Element | null = target; el && el !== stop; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX
      if (ox === 'auto' || ox === 'scroll') return false
    }
  }
  return true
}

type Mode = 'pending' | 'sheet' | 'swipe' | 'native'

interface Gesture {
  mode: Mode
  x0: number
  y0: number
  dx: number
  dy: number
  /** Dari gagang atau tab, bukan dari isi. */
  inHead: boolean
  canSwipe: boolean
  atFull: boolean
  startH: number
  startScroll: number
  height: number
  hSamples: Sample[]
  xSamples: Sample[]
  followers: HTMLElement[]
}

/**
 * Lembar geser di atas peta.
 *
 * Peta kini jadi latar penuh layar, jadi isi app duduk di lembar yang bisa
 * ditarik: rendah untuk melihat peta, tinggi untuk membaca. Tiga posisi jepret
 * cukup — lebih banyak hanya membuat orang menebak-nebak.
 *
 * Di layar sentuh lembar bisa ditarik dari mana saja, bukan hanya gagangnya:
 * selama belum penuh, menarik isinya ke atas membuka lembar lalu langsung
 * menggulir; saat penuh dan isi di puncak, menarik ke bawah menurunkannya.
 * Lemparan cepat berpindah jepret ke arahnya. Geser mendatar berpindah tab.
 *
 * Di layar lebar tidak ada yang perlu ditarik: lembar berubah jadi panel kiri
 * setinggi layar, dan peta memakai sisa ruangnya. Geser mendatar tetap jalan.
 */
export function BottomSheet({
  onMetrics,
  snap,
  onSnapChange,
  header,
  scrollKey,
  topGap = DEFAULT_TOP_GAP,
  page,
  pageCount,
  onPage,
  children,
}: Props) {
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === 'undefined' ? 420 : window.innerWidth,
    h: typeof window === 'undefined' ? 880 : window.innerHeight,
  }))
  const elRef = useRef<HTMLElement | null>(null)
  const movedRef = useRef(false)
  const rafRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const guardUntilRef = useRef(0)

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const wide = viewport.w >= WIDE_PX
  const snaps = snapPointsFor(viewport.h, topGap)
  const height = snaps[snap]
  const panelWidth = wide ? panelWidthFor(viewport.w) : 0
  const full = !wide && snap === snaps.length - 1

  useEffect(() => {
    onMetrics({ height: wide ? 0 : height, wide, panelWidth })
  }, [onMetrics, height, wide, panelWidth])

  /**
   * Pendengar sentuh dipasang sekali; nilai terbaru dibaca lewat ref supaya
   * tidak dilepas-pasang tiap gambar ulang.
   */
  const live = useRef({ wide, snaps, snap, page, pageCount, onPage, onSnapChange })
  useLayoutEffect(() => {
    live.current = { wide, snaps, snap, page, pageCount, onPage, onSnapChange }
  })

  /**
   * Tinggi selama ditarik dipasang langsung ke DOM, tidak lewat state React.
   * Lewat state, satu gerakan jari menggambar ulang seluruh pohon komponen
   * puluhan kali per detik — di ponsel itu terasa tersendat.
   *
   * Yang ikut bergerak — kendali peta, skala, atribusi — ditandai
   * `data-sheet-follow` dan menerima `--sheet-h` sendiri-sendiri. Memasangnya
   * di kerangka app memaksa peramban menghitung ulang gaya seluruh isi lembar
   * tiap frame, karena variabel CSS diwariskan ke semua turunan: diukur dengan
   * CPU diperlambat 4x, itu menurunkan tarikan dari 60 ke 50 fps.
   */
  const applyHeight = useCallback((h: number, followers: readonly HTMLElement[]) => {
    const el = elRef.current
    if (!el) return
    el.style.height = `${h}px`
    for (const f of followers) f.style.setProperty('--sheet-h', `${h}px`)
  }, [])

  const startSheetDrag = useCallback((): HTMLElement[] => {
    const shell = elRef.current?.parentElement ?? null
    // Selama ditarik lembar harus mengikuti jari persis, bukan mengejarnya
    // lewat transisi.
    shell?.setAttribute('data-dragging', 'true')
    return Array.from(shell?.querySelectorAll<HTMLElement>('[data-sheet-follow]') ?? [])
  }, [])

  /** Lepas tarikan: pilih jepret dari posisi dan kecepatan, lalu serahkan ke React. */
  const settleSheet = useCallback(
    (position: number, v: number, followers: readonly HTMLElement[]) => {
      const { snaps: s, onSnapChange: change } = live.current
      elRef.current?.parentElement?.removeAttribute('data-dragging')
      const best = pickSnap(s, position, v)
      // React tidak menyentuh tinggi bila nilai gayanya tidak berubah, jadi
      // saat tarikan berakhir di jepret yang sama, posisi akhirnya harus
      // dipasang sendiri.
      applyHeight(s[best], followers)
      change(best)
      // Sesudah React memasang tinggi jepret di kerangka app, nilai pinjaman
      // dilepas supaya pengikut kembali mewarisinya — nilainya sama, jadi
      // tidak ada yang bergeser.
      requestAnimationFrame(() => {
        for (const f of followers) f.style.removeProperty('--sheet-h')
      })
    },
    [applyHeight],
  )

  // Tetikus dan pena: tarik lewat gagang. Sentuhan ditangani pendengar sentuh
  // di bawah, yang menerima tarikan dari seluruh lembar.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (wide || e.pointerType === 'touch') return
      const startY = e.clientY
      const startH = height
      let latest = startH
      const samples: Sample[] = [{ t: e.timeStamp, v: startH }]
      const followers = startSheetDrag()
      movedRef.current = false

      const move = (ev: PointerEvent) => {
        const dy = ev.clientY - startY
        if (Math.abs(dy) > 4) movedRef.current = true
        latest = dragHeight(snaps, startH, dy, 0, false).height
        samples.push({ t: ev.timeStamp, v: latest })
        if (rafRef.current) return
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0
          applyHeight(latest, followers)
        })
      }
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = 0
        }
        settleSheet(latest, ev.type === 'pointerup' ? velocity(samples, ev.timeStamp) : 0, followers)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [wide, height, snaps, applyHeight, startSheetDrag, settleSheet],
  )

  // Sentuhan: tarik tegak dari mana saja di lembar, geser mendatar antar tab.
  useEffect(() => {
    const el = elRef.current
    const scroller = scrollRef.current
    if (!el || !scroller) return
    let g: Gesture | null = null
    let raf = 0

    const frame = () => {
      raf = 0
      if (!g) return
      if (g.mode === 'sheet') {
        const r = dragHeight(live.current.snaps, g.startH, g.dy, g.startScroll, !g.inHead)
        applyHeight(r.height, g.followers)
        if (scroller.scrollTop !== r.scrollTop) scroller.scrollTop = r.scrollTop
      } else if (g.mode === 'swipe') {
        const { page: p, pageCount: n } = live.current
        const edge = (p === 0 && g.dx > 0) || (p === n - 1 && g.dx < 0)
        const tx = edge ? rubberBand(g.dx, 0, 0, 56) : g.dx
        scroller.style.transform = `translate3d(${tx}px,0,0)`
      }
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const resetSwipe = (animate: boolean) => {
      if (!animate || reducedMotion()) {
        scroller.style.transform = ''
        return
      }
      const from = scroller.style.transform
      scroller.style.transform = ''
      scroller.animate([{ transform: from }, { transform: 'none' }], {
        duration: 220,
        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      })
    }

    const onStart = (e: TouchEvent) => {
      const s = live.current
      if (e.touches.length !== 1) {
        g = null
        return
      }
      const t = e.touches[0]
      const target = e.target as Element
      // Mengambil alih lembar yang sedang beranimasi menuju jepret: tingginya
      // dibaca dari layar, bukan dari jepret tujuannya.
      const startH = s.wide ? 0 : el.getBoundingClientRect().height
      g = {
        mode: 'pending',
        x0: t.clientX,
        y0: t.clientY,
        dx: 0,
        dy: 0,
        inHead: !scroller.contains(target),
        canSwipe: s.pageCount > 1 && swipeAllowed(target, el),
        atFull: s.wide || s.snap === s.snaps.length - 1,
        startH,
        startScroll: scroller.scrollTop,
        height: startH,
        hSamples: [{ t: e.timeStamp, v: startH }],
        xSamples: [{ t: e.timeStamp, v: 0 }],
        followers: [],
      }
    }

    const onMove = (e: TouchEvent) => {
      if (!g || g.mode === 'native') return
      // Peramban sudah mulai menggulir sendiri: gestur ini miliknya.
      if (!e.cancelable) {
        if (g.mode === 'swipe') resetSwipe(true)
        g.mode = 'native'
        return
      }
      const t = e.touches[0]
      g.dx = t.clientX - g.x0
      g.dy = t.clientY - g.y0

      if (g.mode === 'pending') {
        const { wide: isWide } = live.current
        let next: Mode | null = null
        if (!isWide && !g.inHead && g.atFull) {
          // Lembar penuh: isi menggulir sendiri, kecuali ditarik ke bawah
          // saat sudah di puncak isinya.
          if (g.dy >= PULL_SLOP_PX && g.dy >= Math.abs(g.dx) && scroller.scrollTop <= 0) {
            next = 'sheet'
          }
        }
        if (!next) {
          const axis = lockAxis(g.dx, g.dy)
          if (!axis) return
          if (axis === 'x') next = g.canSwipe ? 'swipe' : 'native'
          else next = isWide || (g.atFull && !g.inHead) ? 'native' : 'sheet'
        }
        g.mode = next
        if (next === 'native') return
        if (next === 'sheet') g.followers = startSheetDrag()
        else scroller.style.willChange = 'transform'
      }

      e.preventDefault()
      if (g.mode === 'sheet') {
        const r = dragHeight(live.current.snaps, g.startH, g.dy, g.startScroll, !g.inHead)
        g.height = r.height
        g.hSamples.push({ t: e.timeStamp, v: r.height })
      } else {
        g.xSamples.push({ t: e.timeStamp, v: g.dx })
      }
      schedule()
    }

    const onEnd = (e: TouchEvent) => {
      const cur = g
      if (!cur || e.touches.length > 0) return
      g = null
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      const cancelled = e.type === 'touchcancel'
      if (cur.mode === 'sheet') {
        guardUntilRef.current = performance.now() + CLICK_GUARD_MS
        // Bila lembar tertarik melewati penuh ke dalam gulir, posisinya penuh.
        settleSheet(cur.height, cancelled ? 0 : velocity(cur.hSamples, e.timeStamp), cur.followers)
      } else if (cur.mode === 'swipe') {
        guardUntilRef.current = performance.now() + CLICK_GUARD_MS
        scroller.style.willChange = ''
        const { page: p, pageCount: n, onPage: go } = live.current
        const step = cancelled
          ? 0
          : swipeStep(cur.dx, velocity(cur.xSamples, e.timeStamp), scroller.clientWidth)
        const target = p + step
        if (step !== 0 && target >= 0 && target < n) {
          // Isi lama dilepas di tempatnya; isi baru masuk dari sisi geseran
          // (lihat efek halaman di bawah).
          scroller.style.transform = ''
          go(target)
        } else {
          resetSwipe(true)
        }
      }
    }

    // Klik yang menyusul tarikan bukan ketukan: jangan sampai melepas tarikan
    // di atas tombol tab atau bagian Info ikut menekannya.
    const onClick = (e: MouseEvent) => {
      if (performance.now() < guardUntilRef.current) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    el.addEventListener('click', onClick, true)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.removeEventListener('click', onClick, true)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [applyHeight, startSheetDrag, settleSheet])

  // Ketuk gagang memutar antar tiga posisi — jalan pintas untuk yang tidak
  // ingin menarik, dan satu-satunya cara lewat papan ketik.
  const cycle = useCallback(() => {
    if (wide) return
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    onSnapChange((snap + 1) % 3)
  }, [wide, snap, onSnapChange])

  // Berpindah tab selalu mulai dari awal isinya, bukan dari posisi gulir tab
  // sebelumnya. Bergantung pada penanda tab, bukan pada elemen isinya: elemen
  // itu selalu baru tiap gambar ulang, sehingga dulu gulir orang tersentak ke
  // atas setiap kali data masuk.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [scrollKey])

  // Isi halaman baru masuk dari arah tujuannya — ke kanan untuk tab
  // berikutnya, ke kiri untuk sebelumnya — supaya urutan tab terasa sebagai
  // tempat, bukan sekadar isi yang berganti. Hanya transform dan opacity,
  // yang dikerjakan kompositor tanpa menghitung ulang tata letak.
  const prevPageRef = useRef(page)
  useLayoutEffect(() => {
    const prev = prevPageRef.current
    prevPageRef.current = page
    const scroller = scrollRef.current
    if (prev === page || !scroller || reducedMotion()) return
    const from = page > prev ? 32 : -32
    scroller.animate(
      [
        { transform: `translate3d(${from}px,0,0)`, opacity: 0.4 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    )
  }, [page])

  const style = wide
    ? ({ width: `${panelWidth}px` } as React.CSSProperties)
    : ({ height: `${height}px` } as React.CSSProperties)

  return (
    <section
      ref={elRef}
      className={`sheetpanel${wide ? ' sheetpanel--side' : ''}`}
      style={style}
      data-full={full || undefined}
      aria-label="Panel informasi"
    >
      {!wide && (
        <button
          type="button"
          className="sheetpanel__grip"
          onPointerDown={onPointerDown}
          onClick={cycle}
          aria-label={`Tinggi panel: posisi ${snap + 1} dari 3. Ketuk untuk mengubah.`}
        >
          <span className="sheetpanel__gripbar" aria-hidden="true" />
        </button>
      )}
      <div className="sheetpanel__head">{header}</div>
      <div className="sheetpanel__scroll" ref={scrollRef} data-sheet-scroll>
        {children}
      </div>
    </section>
  )
}
