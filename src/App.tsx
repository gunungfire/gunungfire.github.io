import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppFooter } from './components/AppFooter'
import { BottomSheet, WIDE_PX, type SheetMetrics } from './components/BottomSheet'
import { DataStateBanner } from './components/DataStateBanner'
import { DemoPanel } from './components/DemoPanel'
import { FloatingHeader } from './components/FloatingHeader'
import { MapControls } from './components/MapControls'
import { SheetNav, TAB_ORDER, type TabId } from './components/SheetNav'
import { UpdateBanner } from './components/UpdateBanner'
import { VolcanoMap } from './components/VolcanoMap'
import { NotificationSheet } from './components/sheets/NotificationSheet'
import { VolcanoSheet } from './components/sheets/VolcanoSheet'
import { ReportSheet } from './components/sheets/ReportSheet'
import { InfoTab } from './components/tabs/InfoTab'
import { StatusTab } from './components/tabs/StatusTab'
import { resolveAviationStatus } from './data/aviation'
import type { InfoSectionId } from './data/infoSummary'
import { ridgeItems } from './data/ridge'
import { VOLCANOES } from './data/volcanoes'
import { useAlertWatcher } from './hooks/useAlertWatcher'
import { useAppUpdate } from './hooks/useAppUpdate'
import { useDemo } from './hooks/useDemo'
import { useGeolocation } from './hooks/useGeolocation'
import { useLiveQuakes } from './hooks/useLiveQuakes'
import { useVolcanoSelection } from './hooks/useVolcanoSelection'
import { useNotifications } from './hooks/useNotifications'
import { useStatsMode } from './hooks/useStatsMode'
import { useVisitCount } from './hooks/useVisitCount'
import { useTheme } from './hooks/useTheme'
import { useVolcanoFeed } from './hooks/useVolcanoFeed'
import { sectionLine } from './lib/section'
import { DATA_STATE_COLORS, DATA_STATE_DIM } from './theme'
import type { MapLayer } from './types'

/**
 * Tebakan awal tinggi kepala mengapung, hanya dipakai untuk gambar pertama
 * sebelum kepala benar-benar terukur.
 */
const HEADER_PX = 66
/** Jarak lega antara tumpukan atas dan apa pun di bawahnya. */
const CHROME_GAP = 8
/** Tepi atas tumpukan di layar lebar, tempat banner tidak berada di bawah kepala. */
const WIDE_TOP = 12
/**
 * Posisi GPS dibulatkan sekitar 11 meter sebelum dipakai menghitung garis
 * penampang. Sinyal bergetar beberapa meter tiap pembaruan; tanpa pembulatan,
 * penampang dan garis di peta digambar ulang setiap kali tanpa perubahan yang
 * bisa dilihat siapa pun.
 */
const FIX_ROUND = 1e4

/** Ringkasan satu baris di tab Info, apa adanya sesuai keadaan izin. */
function notifSummary(n: ReturnType<typeof useNotifications>): string {
  if (n.permission === 'unsupported') return 'Tidak didukung peramban ini'
  if (n.permission === 'denied') return 'Diblokir di setelan peramban'
  if (n.permission !== 'granted') return 'Belum diizinkan — ketuk untuk mengatur'
  const on = [
    n.rules.level ? 'peringatan abu' : null,
    n.rules.ash ? 'kualitas udara' : null,
    n.rules.quake ? 'gempa baru' : null,
  ].filter(Boolean)
  return on.length ? `Aktif: ${on.join(', ')}` : 'Aktif, tapi semua aturan dimatikan'
}

export default function App() {
  const { demo, updateDemo } = useDemo()
  const { volcano, volcanoId, selectVolcano } = useVolcanoSelection()
  const { snapshot, level, dataState, refresh } = useVolcanoFeed(volcano, demo)

  const geo = useGeolocation()
  const liveQuakes = useLiveQuakes(volcano)

  const [tab, setTab] = useState<TabId>('status')
  const [infoFocus, setInfoFocus] = useState<{ id: InfoSectionId; seq: number } | null>(null)
  const [layer, setLayer] = useState<MapLayer['id']>('radius')
  const [selectedHour, setSelectedHour] = useState(17)
  const [notifOpen, setNotifOpen] = useState(false)
  const [volcanoOpen, setVolcanoOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [snap, setSnap] = useState(0)
  const [focus, setFocus] = useState<'gunung' | 'saya'>('gunung')
  const [sheet, setSheet] = useState<SheetMetrics>({
    height: 0,
    wide: false,
    panelWidth: 0,
  })
  const notifications = useNotifications()
  const theme = useTheme()
  const appUpdate = useAppUpdate()
  const statsMode = useStatsMode()
  const visits = useVisitCount(statsMode)
  const headRef = useRef<HTMLDivElement | null>(null)
  const bannersRef = useRef<HTMLDivElement | null>(null)
  const [headBottom, setHeadBottom] = useState(HEADER_PX)
  const [chromeTop, setChromeTop] = useState(HEADER_PX + CHROME_GAP)

  /**
   * Tinggi kepala dan banner diukur, bukan ditebak dari angka tetap. Kepala
   * kini memuat cakrawala gunung, dan banner bisa ada atau tidak.
   *
   * Yang dipakai hanya tinggi masing-masing, bukan letaknya: banner diletakkan
   * di bawah kepala lewat --head-h, jadi letaknya berubah sesudah pengukuran
   * ini, sedangkan ResizeObserver hanya berbunyi saat ukurannya berubah.
   */
  useEffect(() => {
    const head = headRef.current
    const banners = bannersRef.current
    if (!head || !banners) return
    const measure = () => {
      const hb = Math.round(head.getBoundingClientRect().bottom)
      const bh = Math.round(banners.getBoundingClientRect().height)
      const wide = window.innerWidth >= WIDE_PX
      // Di layar lebar banner duduk di atas peta, bukan di bawah kepala.
      const base = wide ? WIDE_TOP : hb + CHROME_GAP
      const next = base + (bh > 0 ? bh + CHROME_GAP : 0)
      setHeadBottom((prev) => (prev === hb ? prev : hb))
      setChromeTop((prev) => (prev === next ? prev : next))
    }
    measure()
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(head)
    observer?.observe(banners)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  /**
   * Aksen seluruh layar mengikuti keadaan peringatan abu — satu-satunya
   * penilaian bahaya di app ini yang benar-benar datang dari sumber resmi.
   */
  const aviation = useMemo(
    () => resolveAviationStatus(snapshot.ashAdvisories, volcano.name),
    [snapshot.ashAdvisories, volcano.name],
  )

  useAlertWatcher({
    snapshot,
    aviation,
    notifications,
    paused: demo.dataState !== null || demo.level !== null,
  })

  const fixLat = geo.fix ? Math.round(geo.fix.lat * FIX_ROUND) / FIX_ROUND : null
  const fixLon = geo.fix ? Math.round(geo.fix.lon * FIX_ROUND) / FIX_ROUND : null
  const ashHeading = snapshot.ashfall.ashHeadingDeg
  const section = useMemo(
    () =>
      sectionLine(
        volcano,
        fixLat === null || fixLon === null ? null : { lat: fixLat, lon: fixLon },
        ashHeading,
      ),
    [volcano, fixLat, fixLon, ashHeading],
  )

  const ridge = useMemo(
    () =>
      ridgeItems({
        volcanoes: VOLCANOES,
        selectedId: volcanoId,
        selectedAviation: aviation.id,
        national: snapshot.ashNational,
      }),
    [volcanoId, aviation.id, snapshot.ashNational],
  )

  const dataColors = DATA_STATE_COLORS[dataState.id]

  const shellStyle = {
    '--lv': aviation.colors.color,
    '--lv-line': aviation.colors.line,
    '--lv-wash': aviation.colors.wash,
    '--ds': dataColors.color,
    '--ds-line': dataColors.line,
    '--ds-wash': dataColors.wash,
    '--dim': DATA_STATE_DIM[dataState.id],
    // Kendali peta duduk tepat di atas lembar geser, ikut bergerak bersamanya.
    '--sheet-h': `${sheet.height}px`,
    '--panel-w': `${sheet.panelWidth}px`,
    // Ruang yang dipakai kepala dan banner, supaya kendali bawaan peta —
    // skala, pemilih peta dasar, keterangan warna — tidak duduk di baliknya.
    '--chrome-top': `${chromeTop}px`,
    '--head-h': `${headBottom}px`,
  } as React.CSSProperties

  // Berpindah tab ikut membuka lembar: memilih bagian lalu hanya melihat
  // judulnya saja bukan yang dimaksud orang.
  const changeTab = useCallback((next: TabId) => {
    setTab(next)
    setSnap((s) => Math.max(s, 1))
  }, [])

  // Geser mendatar berpindah tab tanpa mengubah tinggi lembar: orang yang
  // menggeser sedang membaca, dan lembarnya sudah setinggi yang ia mau.
  const swipeToTab = useCallback((index: number) => {
    const next = TAB_ORDER[index]
    if (next) setTab(next)
  }, [])

  /** Buka tab Info, dan bila diminta, langsung ke satu bagiannya. */
  const openInfo = useCallback((section?: InfoSectionId) => {
    setTab('info')
    setSnap(2)
    if (section) setInfoFocus((prev) => ({ id: section, seq: (prev?.seq ?? 0) + 1 }))
  }, [])

  const pickVolcano = useCallback(
    (id: string) => {
      selectVolcano(id)
      setTab('status')
      setFocus('gunung')
    },
    [selectVolcano],
  )

  const onMetrics = useCallback((m: SheetMetrics) => setSheet(m), [])

  const chrome = useMemo(
    () => ({
      top: chromeTop,
      left: sheet.panelWidth,
      bottom: sheet.height,
    }),
    [chromeTop, sheet.panelWidth, sheet.height],
  )

  return (
    <div className="app" style={shellStyle}>
      <div className="app__map">
        <VolcanoMap
          volcano={snapshot.volcano}
          radiusKm={level.radiusKm}
          layer={layer}
          accent={aviation.colors.color}
          geo={geo}
          ashHeadingDeg={snapshot.ashfall.ashHeadingDeg}
          windSpeedKmh={snapshot.ashfall.windSpeedKmh}
          advisories={snapshot.ashAdvisories}
          population={snapshot.population}
          bmkgEpicentres={snapshot.bmkgEpicentres}
          usgsQuakes={liveQuakes.quakes}
          chrome={chrome}
          focus={focus}
          tema={theme.tema}
          sectionEnd={section.end}
        />
      </div>

      <FloatingHeader
        volcano={snapshot.volcano}
        dataState={dataState}
        onRefresh={refresh}
        onPickVolcano={() => setVolcanoOpen(true)}
        tema={theme.tema}
        onToggleTheme={theme.toggle}
        ridge={ridge}
        onSelectVolcano={pickVolcano}
        cardRef={headRef}
      />

      {/* Pita peringatan abu tidak lagi ada di sini: jawabannya kini tertulis
          di puncak lembar, yang terlihat bahkan di posisi lembar terendah. */}
      <div className="app__banners" ref={bannersRef}>
        <DataStateBanner dataState={dataState} onRetry={refresh} />
        {appUpdate.ready && <UpdateBanner onApply={appUpdate.apply} />}
      </div>

      <MapControls
        layers={snapshot.mapLayers}
        layer={layer}
        onLayerChange={setLayer}
        focus={focus}
        onToggleFocus={() =>
          setFocus((f) => (f === 'gunung' ? 'saya' : 'gunung'))
        }
        canFocusUser={geo.fix !== null}
      />

      <BottomSheet
        onMetrics={onMetrics}
        snap={snap}
        onSnapChange={setSnap}
        scrollKey={tab}
        topGap={headBottom + CHROME_GAP}
        page={TAB_ORDER.indexOf(tab)}
        pageCount={TAB_ORDER.length}
        onPage={swipeToTab}
        header={<SheetNav tab={tab} onChange={changeTab} />}
      >
        {tab === 'status' ? (
          <StatusTab
            snapshot={snapshot}
            level={level}
            dataState={dataState}
            aviation={aviation}
            geo={geo}
            section={section}
            onOpenInfo={openInfo}
          />
        ) : (
          <InfoTab
            snapshot={snapshot}
            level={level}
            dataState={dataState}
            aviation={aviation}
            geo={geo}
            liveQuakes={liveQuakes}
            layer={layer}
            showTransport={demo.showTransport}
            selectedHour={selectedHour}
            onSelectHour={setSelectedHour}
            notifSummary={notifSummary(notifications)}
            onOpenNotifications={() => setNotifOpen(true)}
            onOpenReport={() => setReportOpen(true)}
            onShowMap={() => setSnap(0)}
            focus={infoFocus}
          />
        )}

        <AppFooter visits={visits} showVisits={statsMode} />
      </BottomSheet>

      {volcanoOpen && (
        <VolcanoSheet
          activeId={volcanoId}
          onSelect={(id) => {
            pickVolcano(id)
            setVolcanoOpen(false)
          }}
          onClose={() => setVolcanoOpen(false)}
        />
      )}

      {notifOpen && (
        <NotificationSheet
          notifications={notifications}
          onClose={() => setNotifOpen(false)}
        />
      )}

      {reportOpen && (
        <ReportSheet fix={geo.fix} onClose={() => setReportOpen(false)} />
      )}

      <DemoPanel demo={demo} onChange={updateDemo} />
    </div>
  )
}
