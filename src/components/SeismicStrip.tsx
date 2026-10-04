import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { seismotrace } from '../lib/seismotrace'

const W = 390
const H = 46
/** Sesudah jari diangkat, bacaan jam itu tetap terlihat sebentar. */
const LINGER_MS = 1400

interface Props {
  hourly: number[]
  /** Data contoh: digambar putus-putus dan tidak dianimasikan. */
  sample: boolean
  /** Berganti saat gunung berganti: jejaknya digambar ulang dari kiri. */
  replayKey: string
}

/**
 * Jejak gempa per jam di lapisan batuan di bawah penampang.
 *
 * Bisa digeser dengan jari untuk membaca tiap jam. Pergeseran itu sengaja tidak
 * lewat state React: setiap gerakan jari hanya memindahkan satu garis dan
 * mengganti satu teks lewat ref, paling banyak sekali per frame. Lewat state,
 * seluruh lembar akan digambar ulang puluhan kali per detik.
 */
export const SeismicStrip = memo(function SeismicStrip({ hourly, sample, replayKey }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const cursorRef = useRef<SVGLineElement | null>(null)
  const readRef = useRef<HTMLElement | null>(null)
  const rafRef = useRef(0)
  const lingerRef = useRef(0)
  const pendingX = useRef(0)

  const trace = useMemo(() => seismotrace(hourly, W, H), [hourly])
  const total = useMemo(
    () => hourly.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0),
    [hourly],
  )
  const resting = sample ? `${total} gempa · contoh` : `${total} gempa dalam 24 jam`

  const restore = useCallback(() => {
    cursorRef.current?.setAttribute('visibility', 'hidden')
    if (readRef.current) readRef.current.textContent = resting
  }, [resting])

  // Teks bacaan sepenuhnya dikelola lewat ref, tidak lewat anak React: kalau
  // React juga memegang node teksnya, menimpanya saat jari bergeser membuat
  // React memperbarui node yang sudah lepas, dan labelnya membeku. Dipasang
  // sebelum gambar pertama supaya tidak sempat kosong.
  useLayoutEffect(() => {
    restore()
  }, [restore])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      window.clearTimeout(lingerRef.current)
    },
    [],
  )

  const paint = useCallback(() => {
    rafRef.current = 0
    const svg = svgRef.current
    if (!svg || !hourly.length) return
    const rect = svg.getBoundingClientRect()
    const rel = Math.min(rect.width - 1, Math.max(0, pendingX.current - rect.left))
    const i = Math.min(hourly.length - 1, Math.floor((rel / rect.width) * hourly.length))
    const ago = hourly.length - 1 - i
    const vx = ((i + 0.5) * W) / hourly.length
    const cur = cursorRef.current
    if (cur) {
      cur.setAttribute('x1', String(vx))
      cur.setAttribute('x2', String(vx))
      cur.setAttribute('visibility', 'visible')
    }
    if (readRef.current) {
      const n = Number.isFinite(hourly[i]) ? hourly[i] : 0
      readRef.current.textContent = `${ago === 0 ? 'jam ini' : `${ago} jam lalu`} · ${n} gempa`
    }
  }, [hourly])

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      window.clearTimeout(lingerRef.current)
      pendingX.current = e.clientX
      if (!rafRef.current) rafRef.current = requestAnimationFrame(paint)
    },
    [paint],
  )

  const onEnd = useCallback(
    (e: React.PointerEvent) => {
      window.clearTimeout(lingerRef.current)
      if (e.pointerType === 'mouse' && e.type === 'pointerup') return
      lingerRef.current = window.setTimeout(restore, e.pointerType === 'mouse' ? 0 : LINGER_MS)
    },
    [restore],
  )

  return (
    <div className={`seisstrip${sample ? ' seisstrip--sample' : ''}`}>
      <svg
        ref={svgRef}
        className="seisstrip__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          sample
            ? 'Jejak gempa per jam, data contoh: belum tersambung ke katalog gempa.'
            : `Jejak gempa per jam selama 24 jam terakhir: ${total} kejadian.`
        }
        onPointerDown={onMove}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerLeave={onEnd}
        onPointerCancel={onEnd}
      >
        <line className="seisstrip__base" x1="0" x2={W} y1={trace.baseline} y2={trace.baseline} />
        <path
          key={sample ? 'contoh' : replayKey}
          className={`seisstrip__line${sample ? '' : ' seisstrip__line--draw'}`}
          d={trace.d}
          // pathLength 1 membuat animasi gambar cukup dengan CSS, tanpa
          // mengukur panjang garis lewat JavaScript. Tidak dipakai untuk data
          // contoh karena garis putus-putusnya diukur dalam piksel.
          pathLength={sample ? undefined : 1}
        />
        <line ref={cursorRef} className="seisstrip__cursor" x1="0" x2="0" y1="2" y2={H - 2} visibility="hidden" />
        <circle className="seisstrip__now" cx={W - 4} cy={trace.baseline} r="3" />
      </svg>
      <div className="seisstrip__axis">
        <span>24 jam lalu</span>
        <b ref={readRef} />
        <span>kini</span>
      </div>
    </div>
  )
})
