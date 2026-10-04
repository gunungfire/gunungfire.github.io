import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** Di bawah lebar ini lembar geser menempel di bawah; di atasnya jadi panel kiri. */
export const WIDE_PX = 1000

/**
 * Sisa layar di atas lembar saat dibuka penuh, bila induk belum mengukur
 * kepala halaman.
 */
const DEFAULT_TOP_GAP = 76

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

/**
 * Lembar geser di atas peta.
 *
 * Peta kini jadi latar penuh layar, jadi isi app duduk di lembar yang bisa
 * ditarik: rendah untuk melihat peta, tinggi untuk membaca. Tiga posisi jepret
 * cukup — lebih banyak hanya membuat orang menebak-nebak.
 *
 * Di layar lebar tidak ada yang perlu ditarik: lembar berubah jadi panel kiri
 * setinggi layar, dan peta memakai sisa ruangnya.
 */
export function BottomSheet({
  onMetrics,
  snap,
  onSnapChange,
  header,
  scrollKey,
  topGap = DEFAULT_TOP_GAP,
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

  useEffect(() => {
    onMetrics({ height: wide ? 0 : height, wide, panelWidth })
  }, [onMetrics, height, wide, panelWidth])

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

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (wide) return
      const shell = elRef.current?.parentElement ?? null
      const startY = e.clientY
      const startH = height
      let latest = startH
      const followers = Array.from(
        shell?.querySelectorAll<HTMLElement>('[data-sheet-follow]') ?? [],
      )
      movedRef.current = false
      // Selama ditarik lembar harus mengikuti jari persis, bukan mengejarnya
      // lewat transisi.
      shell?.setAttribute('data-dragging', 'true')

      const move = (ev: PointerEvent) => {
        const dy = startY - ev.clientY
        if (Math.abs(dy) > 4) movedRef.current = true
        // Sedikit lebih rendah dari jepret terendah supaya terasa lentur,
        // tapi tidak sampai hilang dari layar.
        latest = Math.max(snaps[0] - 40, Math.min(snaps[2], startH + dy))
        if (rafRef.current) return
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0
          applyHeight(latest, followers)
        })
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = 0
        }
        shell?.removeAttribute('data-dragging')

        let best = 0
        let bestGap = Infinity
        snaps.forEach((v, i) => {
          const gap = Math.abs(v - latest)
          if (gap < bestGap) {
            bestGap = gap
            best = i
          }
        })
        // React tidak menyentuh tinggi bila nilai gayanya tidak berubah, jadi
        // saat tarikan berakhir di jepret yang sama, posisi akhirnya harus
        // dipasang sendiri.
        applyHeight(snaps[best], followers)
        onSnapChange(best)
        // Sesudah React memasang tinggi jepret di kerangka app, nilai pinjaman
        // dilepas supaya pengikut kembali mewarisinya — nilainya sama, jadi
        // tidak ada yang bergeser.
        requestAnimationFrame(() => {
          for (const f of followers) f.style.removeProperty('--sheet-h')
        })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [wide, height, snaps, applyHeight, onSnapChange],
  )

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

  const style = wide
    ? ({ width: `${panelWidth}px` } as React.CSSProperties)
    : ({ height: `${height}px` } as React.CSSProperties)

  return (
    <section
      ref={elRef}
      className={`sheetpanel${wide ? ' sheetpanel--side' : ''}`}
      style={style}
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
