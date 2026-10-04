import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AviationStateId } from '../data/aviation'
import { formatNumber } from '../lib/format'
import {
  ashAlongSection,
  coneAltitudeKm,
  coneFootKm,
  flightLevels,
  kmTicks,
  sectionScale,
  type AshSpan,
  type SectionLine,
} from '../lib/section'
import type { AshAdvisory, VolcanoRef } from '../types'

/**
 * Lebar sebelum terukur. Sesudahnya viewBox selalu sama dengan lebar
 * sebenarnya, jadi satu unit satu piksel: label 11 px tetap 11 px di lembar
 * selebar 320 px, tidak menyusut ikut skala gambar.
 */
const DEFAULT_W = 390
const GROUND = 250
const H = 274
const LEFT_PX = 60
const RIGHT_PX = 24

interface Props {
  volcano: VolcanoRef
  line: SectionLine
  advisories: AshAdvisory[] | null
  aviation: AviationStateId
  /** Radius pembanding level saat ini, digambar sebagai pita merah di tanah. */
  radiusKm: number
}

const BASIS_TEXT: Record<SectionLine['basis'], string> = {
  gps: 'kawah ke Anda',
  angin: 'searah sebaran abu',
  tetap: 'ke timur, tanpa data angin',
}

function fmtKm(km: number): string {
  return km < 10 ? formatNumber(Math.round(km * 10) / 10) : formatNumber(Math.round(km))
}

/**
 * Penampang tegak sepanjang garis A–B yang juga digambar di peta.
 *
 * Langit membawa peringatan abu (dalam flight level, seperti SIGMET itu
 * sendiri), gunung membawa tingginya, tanah membawa posisi Anda. Yang tidak
 * berskala hanya bentuk kerucutnya, dan pelebihan skala tegak ditulis di
 * judulnya. Dibungkus memo: lembar ini digambar ulang tiap kali GPS bergerak.
 */
export const CrossSection = memo(function CrossSection({
  volcano,
  line,
  advisories,
  aviation,
  radiusKm,
}: Props) {
  const figRef = useRef<HTMLElement | null>(null)
  const [W, setW] = useState(DEFAULT_W)

  // Diukur sekali dan hanya saat ukurannya berubah, bukan tiap gambar ulang.
  useLayoutEffect(() => {
    const el = figRef.current
    if (!el) return
    const measure = () => {
      const next = Math.round(el.clientWidth)
      if (next > 0) setW((prev) => (prev === next ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const geom = useMemo(() => {
    const live = advisories?.filter((a) => a.validity !== 'lewat') ?? null
    const tops = (live ?? []).map((a) => (a.topM === null ? 0 : a.topM / 1000))
    const ashTopKm = tops.length ? Math.max(...tops) : null
    const scale = sectionScale({
      spanKm: line.spanKm,
      ashTopKm,
      width: W,
      groundY: GROUND,
      leftPx: LEFT_PX,
      rightPx: RIGHT_PX,
    })
    const behindKm = LEFT_PX / scale.pxX
    const spans: AshSpan[] = (live ?? []).flatMap((a) =>
      ashAlongSection({
        vent: volcano,
        bearingDeg: line.bearingDeg,
        spanKm: line.spanKm,
        behindKm,
        advisory: a,
      }),
    )
    const x = (km: number) => scale.x0 + km * scale.pxX
    const y = (altKm: number) => GROUND - altKm * scale.pxY

    // Kerucut skematis: dicuplik rapat supaya lerengnya halus, dengan lekuk
    // kecil di puncak sebagai kawah.
    const summitKm = volcano.elevationM / 1000
    const foot = coneFootKm(summitKm)
    const from = -Math.min(foot, behindKm)
    const pts: string[] = [`M${x(from).toFixed(1)} ${GROUND}`]
    const step = foot / 40
    for (let d = from; d <= foot + 1e-9; d += step) {
      let alt = coneAltitudeKm(d, summitKm)
      if (Math.abs(d) < foot * 0.035) alt -= summitKm * 0.025
      pts.push(`L${x(d).toFixed(1)} ${y(alt).toFixed(1)}`)
    }
    pts.push(`L${x(foot).toFixed(1)} ${GROUND}Z`)

    return {
      live,
      scale,
      spans,
      x,
      y,
      mountain: pts.join(''),
      summitY: y(summitKm),
      summitKm,
      ticks: kmTicks(line.spanKm),
      levels: flightLevels(scale.altKm),
    }
  }, [W, advisories, line.bearingDeg, line.spanKm, volcano])

  const { scale, spans, x, y, live } = geom
  const userKm = line.userKm
  const onScale = userKm !== null && !line.userOffScale
  const inZone = onScale && userKm <= radiusKm
  const meX = onScale ? x(userKm) : x(line.spanKm * 0.62)
  const meY = onScale ? y(coneAltitudeKm(userKm, geom.summitKm)) : GROUND

  const skyNote =
    live === null
      ? 'peringatan abu tak terbaca'
      : live.length === 0
        ? 'ruang udara bersih'
        : spans.length === 0
          ? 'peringatan abu tidak memotong garis ini'
          : null

  // Catatan langit duduk di tengah antara dua garis FL terbawah, supaya tidak
  // pernah menimpa label FL yang tertulis tepat di atas garisnya.
  const [lowFl, nextFl] = geom.levels
  const noteKm = lowFl ? (lowFl.km + (nextFl?.km ?? scale.altKm)) / 2 : scale.altKm * 0.5
  const noteY = y(noteKm) + 4

  const label = [
    `Penampang dari kawah ${volcano.name} sepanjang garis A–B, ${BASIS_TEXT[line.basis]}.`,
    `Puncak ${formatNumber(volcano.elevationM)} m.`,
    spans.length
      ? `Awan abu memotong garis ini dari ${fmtKm(Math.max(0, spans[0].fromKm))} km, puncaknya ${formatNumber(Math.round(spans[0].topKm * 1000))} m.`
      : skyNote
        ? `${skyNote[0].toUpperCase()}${skyNote.slice(1)}.`
        : '',
    onScale
      ? `Anda ${fmtKm(userKm)} km dari kawah${inZone ? `, di dalam radius ${radiusKm} km` : ''}.`
      : userKm !== null
        ? `Anda ${fmtKm(userKm)} km dari kawah, di luar gambar.`
        : 'Posisi Anda belum diketahui.',
    `Skala tegak dilebihkan ${scale.exaggeration} kali.`,
  ].join(' ')

  return (
    <figure className={`xsec xsec--${aviation}`} ref={figRef}>
      <figcaption className="xsec__cap">
        <span>
          Penampang <b>A → B</b> · {line.userOffScale ? 'ke arah Anda' : BASIS_TEXT[line.basis]}
        </span>
        <span>tegak ×{scale.exaggeration}</span>
      </figcaption>
      <svg className="xsec__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <pattern id="xsec-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line className="xsec__hatch" x1="0" y1="0" x2="0" y2="7" />
          </pattern>
        </defs>

        {geom.levels.map((f) => (
          <g key={f.fl}>
            <line className="xsec__fl" x1="0" x2={W} y1={y(f.km)} y2={y(f.km)} />
            <text className="xsec__flt" x={W - RIGHT_PX} y={y(f.km) - 5} textAnchor="end">
              FL{f.fl} · {formatNumber(Math.round(f.km * 10) / 10)} km
            </text>
          </g>
        ))}

        {spans.map((s, i) => {
          const x1 = x(Math.max(s.fromKm, -LEFT_PX / scale.pxX))
          const x2 = x(Math.min(s.toKm, line.spanKm))
          return (
            <g key={i}>
              <rect
                className="xsec__ash"
                x={x1}
                y={y(s.topKm)}
                width={Math.max(4, x2 - x1)}
                height={Math.max(4, y(s.baseKm) - y(s.topKm))}
                rx="6"
              />
              {i === 0 && (
                <text className="xsec__asht" x={Math.min(x1 + 6, W - 150)} y={y(s.topKm) - 6}>
                  abu sampai {formatNumber(Math.round(s.topKm * 1000))} m
                </text>
              )}
            </g>
          )
        })}

        {skyNote && (
          <text className="xsec__note" x={x(line.spanKm * 0.55)} y={noteY} textAnchor="middle">
            {skyNote}
          </text>
        )}

        <rect className="xsec__ground" x="0" y={GROUND} width={W} height={H - GROUND} />
        <rect className="xsec__zone" x={x(0)} y={GROUND - 1.5} width={Math.max(0, x(Math.min(radiusKm, line.spanKm)) - x(0))} height="3" />
        <path className="xsec__mtn" d={geom.mountain} />
        <line className="xsec__tick" x1={x(0) + 8} x2={x(0) + 30} y1={geom.summitY} y2={geom.summitY} />
        <text className="xsec__summit" x={x(0) + 34} y={geom.summitY + 4}>
          {formatNumber(volcano.elevationM)} m
        </text>
        <text className="xsec__ab" x={x(0)} y={geom.summitY - 10} textAnchor="middle">
          A
        </text>

        <g
          className="xsec__me"
          data-zone={onScale ? (inZone ? 'in' : 'out') : userKm === null ? 'off' : 'far'}
          transform={`translate(${meX.toFixed(1)} ${meY.toFixed(1)})`}
        >
          {userKm === null || onScale ? (
            <>
              <circle className="xsec__mehead" cx="0" cy="-19" r="3.4" />
              <path className="xsec__mebody" d="M0 -15 L0 -6 M0 -6 L-3.5 0 M0 -6 L3.5 0 M-4 -12 L4 -12" />
              <text className="xsec__met" x="0" y="-28" textAnchor="middle">
                {userKm === null ? 'Anda di mana?' : `B · Anda ${fmtKm(userKm)} km`}
              </text>
            </>
          ) : null}
        </g>
        {line.userOffScale && userKm !== null && (
          <text className="xsec__met xsec__met--far" x={W - RIGHT_PX} y={GROUND - 12} textAnchor="end">
            Anda {fmtKm(userKm)} km →
          </text>
        )}
        {/* Saat Anda ada di gambar, sosok Anda adalah titik B dan labelnya
            sudah menyebutnya; label B terpisah hanya untuk ujung garis. */}
        {!onScale && (
          <text className="xsec__ab" x={W - RIGHT_PX} y={GROUND - (line.userOffScale ? 30 : 12)} textAnchor="end">
            B
          </text>
        )}

        <line className="xsec__axis" x1={x(0)} x2={x(0)} y1={GROUND} y2={GROUND + 5} />
        {geom.ticks.map((t) => (
          <g key={t}>
            <line className="xsec__axis" x1={x(t)} x2={x(t)} y1={GROUND} y2={GROUND + 5} />
            <text className="xsec__kmt" x={x(t)} y={GROUND + 18} textAnchor={t === line.spanKm ? 'end' : 'middle'}>
              {t === line.spanKm ? `${t} km` : t}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
})
