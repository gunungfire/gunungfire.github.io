import { useMemo, useState } from 'react'
import { aqiBand } from '../../data/aqi'
import type { AviationStatus } from '../../data/aviation'
import type { DataStateView } from '../../data/dataState'
import type { GeolocationState } from '../../hooks/useGeolocation'
import { formatAge } from '../../lib/format'
import { distanceKm, zoneVerdict } from '../../lib/geo'
import type { SectionLine } from '../../lib/section'
import type { VolcanoLevel, VolcanoSnapshot } from '../../types'
import { CrossSection } from '../CrossSection'
import { QuickFacts } from '../QuickFacts'
import { SeismicStrip } from '../SeismicStrip'
import type { InfoSectionId } from '../../data/infoSummary'

interface Props {
  snapshot: VolcanoSnapshot
  level: VolcanoLevel
  dataState: DataStateView
  aviation: AviationStatus
  geo: GeolocationState
  section: SectionLine
  onOpenInfo: (section?: InfoSectionId) => void
}

/**
 * Layar pertama: satu jawaban, satu gambar, tiga angka, satu tindakan.
 *
 * Jawabannya ditulis di langit penampang, karena itulah yang ditanyakan orang
 * pertama kali: ada abu atau tidak. Semua isi lain tetap ada di tab Info.
 */
export function StatusTab({
  snapshot,
  level,
  dataState,
  aviation,
  geo,
  section,
  onOpenInfo,
}: Props) {
  const [stepsOpen, setStepsOpen] = useState(false)
  const fresh = dataState.id === 'fresh'

  // Data yang tidak segar tidak boleh terdengar sepasti data segar: titik di
  // akhir jawaban berganti tanda tanya.
  const word = fresh ? aviation.verdict : aviation.verdict.replace(/\.$/, '?')
  const wordColor = !fresh
    ? 'var(--c-text-3)'
    : aviation.id === 'clear'
      ? 'var(--c-text)'
      : aviation.colors.color

  const position = useMemo(() => {
    if (!geo.fix) return null
    const km = distanceKm({ lat: geo.fix.lat, lon: geo.fix.lon }, snapshot.volcano)
    return { km, verdict: zoneVerdict(km, level.radiusKm, geo.fix.accuracyM) }
  }, [geo.fix, snapshot.volcano, level.radiusKm])

  const aqi = snapshot.air?.aqi ?? null
  const band = aqi === null ? null : aqiBand(aqi)
  const seismicSample = snapshot.provenance.seismic === 'sample'

  return (
    <div className={`stview stview--${aviation.id}`}>
      <div className={`stsky stsky--${aviation.id}`}>
        {/* Kunci berganti saat gunung atau statusnya berganti, sehingga
            jawaban baru diputar masuk — data yang sama tidak beranimasi ulang. */}
        <div className="verdict" key={`${snapshot.volcano.id}:${aviation.id}:${fresh}`}>
          <div className="verdict__k">Abu di jalur terbang</div>
          <p className="verdict__v" style={{ color: wordColor }}>
            {word}
          </p>
          <p className="verdict__lede">{aviation.headline}</p>
          {!fresh && (
            <span className="verdict__stale">
              {dataState.label} · {dataState.sourceTime}
            </span>
          )}
        </div>

        <CrossSection
          volcano={snapshot.volcano}
          line={section}
          advisories={snapshot.ashAdvisories}
          aviation={aviation.id}
          radiusKm={level.radiusKm}
        />
      </div>

      <SeismicStrip
        hourly={snapshot.seismicHourly}
        sample={seismicSample}
        replayKey={snapshot.volcano.id}
      />

      <QuickFacts
        distanceKm={position?.km ?? null}
        verdict={position?.verdict ?? null}
        radiusKm={level.radiusKm}
        geoStatus={geo.status}
        onEnableLocation={geo.request}
        aqi={aqi}
        band={band}
        onOpenLevel={() => onOpenInfo('level')}
      />

      {dataState.isFailed && (
        <div className="failnote stview__pad">
          <div className="failnote__t">Data terbaru gagal dimuat</div>
          <div className="failnote__n">
            Yang tampil adalah catatan terakhir yang tersimpan,{' '}
            {formatAge(dataState.ageMinutes)}. Jangan dijadikan dasar keputusan.
          </div>
        </div>
      )}

      <div className="stact">
        <button
          type="button"
          className={`stact__btn stact__btn--${aviation.id}`}
          aria-expanded={stepsOpen}
          onClick={() => setStepsOpen((v) => !v)}
        >
          <span>Yang harus saya lakukan</span>
          <span aria-hidden="true">{stepsOpen ? '↑' : '↓'}</span>
        </button>
        {stepsOpen && (
          <ol className="stact__steps">
            {snapshot.quickActions.map((item, i) => (
              <li key={item.n} style={{ '--step': i } as React.CSSProperties}>
                <span className="mono">{item.n}</span>
                {item.text}
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="stact__more" onClick={() => onOpenInfo()}>
          Semua info, panduan, dan sumber →
        </button>
      </div>
    </div>
  )
}
