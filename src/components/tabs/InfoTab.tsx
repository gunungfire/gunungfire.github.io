import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AviationStatus } from '../../data/aviation'
import type { DataStateView } from '../../data/dataState'
import {
  INFO_ORDER,
  INFO_TITLE,
  infoSummaries,
  type InfoSectionId,
} from '../../data/infoSummary'
import type { GeolocationState } from '../../hooks/useGeolocation'
import type { LiveQuakesState } from '../../hooks/useLiveQuakes'
import { distanceKm, zoneVerdict } from '../../lib/geo'
import type { MapLayer, VolcanoLevel, VolcanoSnapshot } from '../../types'
import { AirQualityCard } from '../AirQualityCard'
import { AshWindCard } from '../AshWindCard'
import { AviationCard } from '../AviationCard'
import { InstallPrompt } from '../InstallPrompt'
import { LiveQuakeList } from '../LiveQuakeList'
import { OfficialLevelCard } from '../OfficialLevelCard'
import { PositionCard } from '../PositionCard'
import { SeismicPanel } from '../SeismicPanel'
import { AreaTab } from './AreaTab'
import { AviationTab } from './AviationTab'
import { FeedTab } from './FeedTab'
import { GuideTab } from './GuideTab'

export type { InfoSectionId }

interface Props {
  snapshot: VolcanoSnapshot
  level: VolcanoLevel
  dataState: DataStateView
  aviation: AviationStatus
  geo: GeolocationState
  liveQuakes: LiveQuakesState
  layer: MapLayer['id']
  showTransport: boolean
  selectedHour: number
  onSelectHour: (index: number) => void
  notifSummary: string
  onOpenNotifications: () => void
  onOpenReport: () => void
  onShowMap: () => void
  /** Bagian yang diminta dibuka dari layar lain; `seq` berganti tiap permintaan. */
  focus: { id: InfoSectionId; seq: number } | null
}

interface SectionProps {
  id: InfoSectionId
  summary: string
  open: boolean
  onToggle: (id: InfoSectionId) => void
  children: ReactNode
}

function InfoSection({ id, summary, open, onToggle, children }: SectionProps) {
  const bodyId = `info-${id}-isi`
  return (
    <section className={`isec${open ? ' isec--open' : ''}`} id={`info-${id}`}>
      <h2 className="isec__h">
        <button
          type="button"
          className="isec__btn"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          onClick={() => onToggle(id)}
        >
          <span className="isec__t">{INFO_TITLE[id]}</span>
          <span className="isec__a">{summary}</span>
          <span className="isec__chev" aria-hidden="true" />
        </button>
      </h2>
      {/* Isi baru dirender saat dibuka. Dengan <details>, kedelapan bagian —
          termasuk daftar SIGMET dan grafik kegempaan — ikut dirender di awal
          walau tertutup. */}
      {open && (
        <div className="isec__body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  )
}

function scrollToSection(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  })
}

/**
 * Semua yang tidak ada di layar Status: isi empat tab lama dan kartu-kartu
 * yang dulu menumpuk di Status, terlipat dengan ringkasan satu baris. Tidak
 * ada yang dibuang, hanya ditata ulang.
 */
export function InfoTab({
  snapshot,
  level,
  dataState,
  aviation,
  geo,
  liveQuakes,
  layer,
  showTransport,
  selectedHour,
  onSelectHour,
  notifSummary,
  onOpenNotifications,
  onOpenReport,
  onShowMap,
  focus,
}: Props) {
  const [open, setOpen] = useState<ReadonlySet<InfoSectionId>>(() => new Set())

  const toggle = useCallback((id: InfoSectionId) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const reveal = useCallback((id: InfoSectionId) => {
    setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    scrollToSection(`info-${id}`)
  }, [])

  useEffect(() => {
    if (focus) reveal(focus.id)
  }, [focus, reveal])

  const position = useMemo(() => {
    if (!geo.fix) return null
    const km = distanceKm({ lat: geo.fix.lat, lon: geo.fix.lon }, snapshot.volcano)
    return { km, verdict: zoneVerdict(km, level.radiusKm, geo.fix.accuracyM) }
  }, [geo.fix, snapshot.volcano, level.radiusKm])

  const summary = infoSummaries({
    aviationShort: aviation.short,
    aviationAction: aviation.action,
    national: snapshot.ashNational,
    position,
    radiusKm: level.radiusKm,
    aqi: snapshot.air?.aqi ?? null,
    windDirection: snapshot.ashfall.windDirection,
    windSample: snapshot.ashfall.windProvenance === 'sample',
    seismicHourly: snapshot.seismicHourly,
    seismicSample: snapshot.provenance.seismic === 'sample',
    population: snapshot.population,
    feedCount: snapshot.feed.length,
  })

  const body: Record<InfoSectionId, () => ReactNode> = {
    abu: () => (
      <>
        <AviationCard
          status={aviation}
          dataState={dataState}
          advisoryCount={snapshot.ashAdvisories?.length ?? null}
          onOpenAviation={() => scrollToSection('info-abu-teks')}
        />
        <div id="info-abu-teks">
          <AviationTab snapshot={snapshot} status={aviation} dataState={dataState} showTransport={false} />
        </div>
      </>
    ),
    posisi: () => (
      <PositionCard
        geo={geo}
        volcano={snapshot.volcano}
        level={level}
        ashfall={snapshot.ashfall}
        shelters={snapshot.shelters}
        provenance={snapshot.provenance}
        onShowShelters={() => reveal('panduan')}
        onShowMap={onShowMap}
      />
    ),
    level: () => <OfficialLevelCard level={level} />,
    udara: () => (
      <>
        {snapshot.air ? (
          <AirQualityCard air={snapshot.air} dataState={dataState} />
        ) : (
          <p className="emptynote">
            Data kualitas udara untuk {snapshot.volcano.name} belum bisa dimuat.
          </p>
        )}
        <AshWindCard ashfall={snapshot.ashfall} dataState={dataState} />
      </>
    ),
    gempa: () => (
      <>
        <LiveQuakeList live={liveQuakes} volcano={snapshot.volcano} nowISO={snapshot.fetchedAtISO} />
        <SeismicPanel
          snapshot={snapshot}
          dataState={dataState}
          selectedHour={selectedHour}
          onSelectHour={onSelectHour}
        />
      </>
    ),
    wilayah: () => (
      <AreaTab
        snapshot={snapshot}
        level={level}
        dataState={dataState}
        layer={layer}
        showTransport={showTransport}
      />
    ),
    laporan: () => <FeedTab snapshot={snapshot} onOpenReport={onOpenReport} />,
    panduan: () => <GuideTab snapshot={snapshot} aviation={aviation} />,
  }

  return (
    <div className="infoview">
      {INFO_ORDER.map((id) => (
        <InfoSection key={id} id={id} summary={summary[id]} open={open.has(id)} onToggle={toggle}>
          {open.has(id) ? body[id]() : null}
        </InfoSection>
      ))}

      <button type="button" className="notifrow" onClick={onOpenNotifications}>
        <span className="notifrow__body">
          <span className="notifrow__title">Notifikasi perubahan status</span>
          <span className="notifrow__note">{notifSummary}</span>
        </span>
        <span className="notifrow__action">Atur</span>
      </button>

      <InstallPrompt />
    </div>
  )
}
