import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { destinationPoint, distanceKm } from '../lib/geo'
import { formatNumber } from '../lib/format'
import type { GeolocationState } from '../hooks/useGeolocation'
import type { LiveQuake } from '../hooks/useLiveQuakes'
import type { AshAdvisory, Epicentre, MapLayer, VolcanoRef } from '../types'

export type BaseMapId = 'jalan' | 'relief'

interface BaseMapDef {
  id: BaseMapId
  label: string
  url: string
  attribution: string
  maxZoom: number
}

/**
 * Dua peta dasar, keduanya terbuka dan wajib membawa atribusinya. Relief
 * dipakai karena bentuk lereng menentukan ke mana aliran dan lahar turun —
 * hal yang tidak terlihat sama sekali di peta jalan.
 */
const BASE_MAPS: BaseMapDef[] = [
  {
    id: 'jalan',
    label: 'Jalan',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© Kontributor OpenStreetMap',
    maxZoom: 17,
  },
  {
    id: 'relief',
    label: 'Relief',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      '© Kontributor OpenStreetMap · SRTM · tampilan © OpenTopoMap (CC-BY-SA)',
    maxZoom: 15,
  },
]

interface Props {
  volcano: VolcanoRef
  /** Radius pembanding dalam km — bukan zona resmi Badan Geologi. */
  radiusKm: number
  layer: MapLayer['id']
  accent: string
  geo: GeolocationState
  /** Arah tujuan abu dalam derajat, dihitung dari angin sungguhan. */
  ashHeadingDeg: number | null
  windSpeedKmh: number
  advisories: AshAdvisory[] | null
  /** Cincin radius WorldPop, untuk digambar bersama jumlah penduduknya. */
  population: { year: number; rings: { radiusKm: number; people: number }[] } | null
  /** Episentrum BMKG dan USGS; keduanya sudah tersaring ke sekitar gunung. */
  bmkgEpicentres: Epicentre[]
  usgsQuakes: LiveQuake[]
  /**
   * Ruang yang tertutup antarmuka mengapung. Peta kini jadi latar penuh layar,
   * jadi tanpa ini bentuk-bentuknya akan dipas ke tengah layar dan separuhnya
   * bersembunyi di balik lembar geser atau kepala halaman.
   */
  chrome: { top: number; left: number; bottom: number }
  /** Ke mana peta dipusatkan: kawah, atau posisi pengguna. */
  focus: 'gunung' | 'saya'
  /** Bukan untuk dibaca isinya — pemicu agar bentuk digambar ulang saat tema berganti. */
  tema: string
  /**
   * Garis penampang A–B: dari kawah ke posisi Anda, atau searah sebaran abu.
   * Penampang di lembar adalah irisan sepanjang garis ini.
   */
  sectionEnd: { lat: number; lon: number }
}

/*
 * Leaflet menggambar ke SVG lewat atribut, bukan lewat CSS, jadi ia butuh
 * nilai warna sungguhan — var(--...) tidak bisa dipakai di sini. Nilainya
 * dibaca dari token yang sama yang dipakai seluruh app, saat menggambar.
 *
 * Ini penting untuk tema terang: bentuk di peta duduk di atas petak yang
 * berubah dari redup jadi cerah, dan hijau muda penanda posisi yang jelas di
 * atas petak gelap nyaris hilang di atas petak terang.
 */
function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return v || fallback
}

/**
 * Warna aksen datang dari lapisan data sebagai penunjuk token — bentuknya
 * "var(--c-alert)". Bagus untuk CSS, tidak berguna untuk Leaflet, jadi di sini
 * ditukar dengan nilai warnanya.
 */
function resolveColor(value: string, fallback: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(value.trim())
  return m ? token(m[1], fallback) : value
}

interface MapPalette {
  danger: string
  model: string
  safe: string
  sea: string
  watch: string
  alert: string
  neutral: string
  /** Garis tepi penanda, supaya bentuk tetap punya batas di dua tema. */
  stroke: string
  /** Garis penampang A–B; biru supaya tak tertukar dengan warna bahaya. */
  section: string
  pager: Record<string, string>
}

function readPalette(): MapPalette {
  const safe = token('--c-safe', '#4ade80')
  const watch = token('--c-watch', '#facc15')
  const alert = token('--c-alert', '#fb923c')
  const danger = token('--c-danger', '#f87171')
  return {
    safe,
    watch,
    alert,
    danger,
    model: token('--c-model', '#c084fc'),
    sea: token('--c-sea', '#38bdf8'),
    neutral: token('--c-neutral', '#94a3b8'),
    stroke: token('--c-page', '#0d1117'),
    section: token('--c-section', '#7aa2ff'),
    /** Warna PAGER USGS — satu-satunya penilaian dampak resmi yang kita punya. */
    pager: { green: safe, yellow: watch, orange: alert, red: danger },
  }
}

/** Jari-jari penanda gempa mengikuti magnitudo, dibatasi agar tetap terbaca. */
function magRadius(mag: number): number {
  return Math.max(4, Math.min(16, 3 + mag * 1.6))
}

function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(3)}°${lat < 0 ? 'S' : 'N'} ${Math.abs(lon).toFixed(3)}°${lon < 0 ? 'W' : 'E'}`
}

const clockWIB = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

/**
 * Peta sungguhan: petak dasar OpenStreetMap atau OpenTopoMap, semua bentuk di
 * atasnya digambar dari koordinat asli.
 *
 * Aturan yang dipegang di sini sama dengan sisa app: tidak ada bentuk karangan.
 * Prototipe memakai poligon abu ilustratif dan enam penanda desa yang ditulis
 * tangan; keduanya tidak dipakai. Yang digambar hanya kawah dari katalog
 * Smithsonian, poligon SIGMET apa adanya dari otoritas penerbangan, arah abu
 * dari angin terukur, cincin penduduk WorldPop, episentrum BMKG dan USGS, serta
 * posisi GPS pengguna sendiri.
 */
export function VolcanoMap({
  volcano,
  radiusKm,
  layer,
  accent,
  geo,
  ashHeadingDeg,
  windSpeedKmh,
  advisories,
  population,
  bmkgEpicentres,
  usgsQuakes,
  chrome,
  focus,
  tema,
  sectionEnd,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseRef = useRef<L.TileLayer | null>(null)
  const drawnRef = useRef<L.Layer[]>([])
  const geoDrawnRef = useRef<L.Layer[]>([])
  const [baseId, setBaseId] = useState<BaseMapId>('jalan')
  const [tilesFailed, setTilesFailed] = useState(false)

  /**
   * Ruang tertutup dibaca lewat ref, bukan lewat daftar kebergantungan efek.
   * Angkanya berubah setiap kali lembar geser bergerak, dan dulu itu ikut
   * memicu peta memasang ulang pandangannya — zoom yang baru saja disetel
   * pengguna langsung hilang begitu lembar disentuh.
   */
  const chromeRef = useRef(chrome)
  chromeRef.current = chrome

  /** Titik-titik yang harus muat di layar, dipisah supaya bisa digabung. */
  const dataFocusRef = useRef<L.LatLngExpression[]>([])
  const userFocusRef = useRef<L.LatLngExpression[]>([])
  /** Sudah pernah digeser atau di-zoom sendiri oleh pengguna. */
  const userMovedRef = useRef(false)
  /** Menandai gerakan yang kita sendiri lakukan, agar tidak terhitung. */
  const programmaticRef = useRef(false)
  /** Pandangan hanya dipaksa ulang saat gunung, lapisan, atau radius berganti. */
  const viewKeyRef = useRef<string | null>(null)
  const hadFixRef = useRef(false)

  /**
   * Memasukkan seluruh bentuk ke dalam bagian peta yang tidak tertutup
   * antarmuka. Kecuali dipaksa, pandangan yang sudah diatur pengguna tidak
   * pernah diambil alih — data yang masuk di latar belakang tidak boleh
   * menyentak peta yang sedang dibaca.
   */
  const fitToFocus = useCallback((force: boolean) => {
    const map = mapRef.current
    if (!map) return
    if (!force && userMovedRef.current) return
    const bounds = L.latLngBounds([
      ...dataFocusRef.current,
      ...userFocusRef.current,
    ])
    if (!bounds.isValid()) return
    const c = chromeRef.current
    programmaticRef.current = true
    map.fitBounds(bounds, {
      paddingTopLeft: [28 + c.left, 28 + c.top],
      paddingBottomRight: [28, 28 + c.bottom],
      maxZoom: 12,
      animate: false,
    })
    programmaticRef.current = false
    if (force) userMovedRef.current = false
  }, [])

  // Peta dibuat sekali seumur hidup komponen. Berpindah gunung hanya
  // memindahkan pandangannya — membangun ulang seluruh peta membuat petaknya
  // berkedip putih dan memuat ulang semuanya dari awal.
  useEffect(() => {
    const host = hostRef.current
    if (!host || mapRef.current) return

    const map = L.map(host, {
      center: [volcano.lat, volcano.lon],
      zoom: 9,
      zoomControl: false,
      // Zoom lewat roda tetikus dulu dimatikan agar gulir halaman tidak
      // tersangkut di peta. Halaman ini tidak bergulir lagi — yang bergulir
      // isi lembar geser — jadi rodanya dikembalikan ke fungsinya.
      scrollWheelZoom: true,
      attributionControl: true,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    // Skala metrik: satu-satunya cara pembaca menilai jarak sebenarnya.
    L.control.scale({ position: 'topleft', imperial: false }).addTo(map)
    // Sudut bawah peta duduk di atas lembar geser; lembar memberinya tinggi
    // langsung selama ditarik (lihat BottomSheet).
    host
      .querySelectorAll('.leaflet-bottom')
      .forEach((corner) => corner.setAttribute('data-sheet-follow', ''))

    const remember = () => {
      if (!programmaticRef.current) userMovedRef.current = true
    }
    map.on('dragstart', remember)
    map.on('zoomstart', remember)

    mapRef.current = map
    // Kartu peta sering baru mendapat ukuran akhirnya setelah tata letak
    // selesai; tanpa ini petaknya hanya terisi sebagian.
    const nudge = [60, 250, 700].map((ms) =>
      window.setTimeout(() => map.invalidateSize(), ms),
    )
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => map.invalidateSize())
    observer?.observe(host)

    return () => {
      nudge.forEach(window.clearTimeout)
      observer?.disconnect()
      map.off('dragstart', remember)
      map.off('zoomstart', remember)
      map.remove()
      mapRef.current = null
      baseRef.current = null
      drawnRef.current = []
      geoDrawnRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Petak dasar dipasang terpisah supaya bisa ditukar tanpa membangun ulang.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const def = BASE_MAPS.find((b) => b.id === baseId) ?? BASE_MAPS[0]
    if (baseRef.current) map.removeLayer(baseRef.current)
    setTilesFailed(false)
    const tiles = L.tileLayer(def.url, {
      attribution: def.attribution,
      maxZoom: def.maxZoom,
    })
    // Petak gagal berarti sedang offline atau penyedia menolak; itu harus
    // terlihat, bukan menyisakan layar kosong tanpa penjelasan.
    tiles.on('tileerror', () => setTilesFailed(true))
    tiles.on('tileload', () => setTilesFailed(false))
    tiles.addTo(map)
    baseRef.current = tiles
  }, [baseId])

  /**
   * Isi peta dibandingkan lewat isinya, bukan lewat identitas objeknya.
   * Snapshot dibangun ulang setiap beberapa detik walau datanya sama persis;
   * tanpa ini seluruh bentuk di peta dihapus lalu dipasang ulang terus-menerus,
   * yang menutup popup yang sedang dibaca dan membuat peta terasa berat.
   */
  const dataKey = JSON.stringify([
    advisories,
    population,
    bmkgEpicentres,
    usgsQuakes,
  ])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    drawnRef.current.forEach((item) => map.removeLayer(item))
    drawnRef.current = []
    const pal = readPalette()
    const accentColor = resolveColor(accent, pal.alert)
    const add = (item: L.Layer) => {
      item.addTo(map)
      drawnRef.current.push(item)
    }

    const vent: L.LatLngExpression = [volcano.lat, volcano.lon]
    // Semua yang perlu terlihat pada lapisan ini, untuk menyetel pandangan.
    const focusPoints: L.LatLngExpression[] = [vent]

    add(
      L.circle(vent, {
        radius: radiusKm * 1000,
        color: pal.danger,
        weight: 2,
        dashArray: '5 5',
        fillColor: pal.danger,
        fillOpacity: 0.12,
      }).bindPopup(
        `Radius pembanding ${radiusKm} km. Zona terlarang resmi hanya ditetapkan Badan Geologi dan belum tersambung.`,
      ),
    )
    /** Empat ujung sebuah lingkaran, supaya fitBounds memuat seluruhnya. */
    const ringEdges = (km: number): L.LatLngExpression[] =>
      [0, 90, 180, 270].map((bearing) => {
        const p = destinationPoint(
          { lat: volcano.lat, lon: volcano.lon },
          bearing,
          km,
        )
        return [p.lat, p.lon] as L.LatLngExpression
      })

    focusPoints.push(...ringEdges(radiusKm))

    if (layer === 'radius' && population) {
      // Cincin WorldPop: jaraknya nyata dan jumlah penduduknya nyata, jadi
      // pembaca bisa melihat berapa orang ada di dalam tiap jarak.
      for (const ring of population.rings) {
        add(
          L.circle(vent, {
            radius: ring.radiusKm * 1000,
            color: pal.model,
            weight: 1,
            opacity: 0.65,
            fill: false,
            dashArray: '3 7',
          })
            .bindTooltip(`${ring.radiusKm} km · ${formatNumber(ring.people)} jiwa`, {
              direction: 'top',
              sticky: true,
            })
            .bindPopup(
              `Sekitar ${formatNumber(ring.people)} jiwa tinggal dalam radius ${ring.radiusKm} km dari kawah. Model sebaran penduduk WorldPop ${population.year} beresolusi 100 m — bukan sensus terkini, bukan hitungan orang yang sedang berada di sana hari ini.`,
            ),
        )
        focusPoints.push(...ringEdges(ring.radiusKm))
      }
    }

    if (layer === 'abu') {
      // Poligon SIGMET adalah area yang benar-benar dinyatakan otoritas
      // penerbangan — ini satu-satunya sebaran abu yang boleh digambar.
      for (const a of advisories ?? []) {
        if (!a.polygon) continue
        add(
          L.polygon(a.polygon, {
            color: a.namedHere ? '#cbd5e1' : '#64748b',
            weight: 1.5,
            fillColor: pal.neutral,
            fillOpacity: a.namedHere ? 0.28 : 0.14,
            dashArray: a.namedHere ? undefined : '4 5',
          }).bindPopup(
            `Area peringatan abu ${a.fir ?? 'FIR tidak disebut'}${
              a.topFt === null ? '' : `, puncak FL${Math.round(a.topFt / 100)}`
            }. ${
              a.namedHere
                ? `Teksnya menyebut ${volcano.name}.`
                : 'Teksnya tidak menyebut gunung ini — bisa milik gunung lain.'
            } Sumber: SIGMET via NOAA Aviation Weather Center.`,
          ),
        )
        for (const point of a.polygon) focusPoints.push(point)
      }

      // Arah angin terukur, digambar sebagai garis dari kawah. Panjangnya
      // jarak tempuh satu jam — bukan klaim sejauh mana abu benar-benar jatuh.
      if (ashHeadingDeg !== null && windSpeedKmh > 0) {
        const tip = destinationPoint(
          { lat: volcano.lat, lon: volcano.lon },
          ashHeadingDeg,
          windSpeedKmh,
        )
        add(
          L.polyline([vent, [tip.lat, tip.lon]], {
            color: accentColor,
            weight: 3,
            opacity: 0.85,
            dashArray: '2 6',
          })
            .bindTooltip(`abu terbawa ke sini · ${windSpeedKmh} km/jam`, {
              direction: 'top',
            })
            .bindPopup(
              `Angin membawa abu ke arah ini, ${windSpeedKmh} km/jam. Panjang garis = jarak tempuh satu jam, bukan batas jatuhnya abu. Sumber: Open-Meteo.`,
            ),
        )
        focusPoints.push([tip.lat, tip.lon])
      }
    }

    if (layer === 'gempa') {
      for (const q of bmkgEpicentres) {
        const mag = Number.parseFloat(q.magnitude.replace(',', '.'))
        add(
          L.circleMarker([q.lat, q.lon], {
            radius: magRadius(Number.isFinite(mag) ? mag : 3),
            color: pal.stroke,
            weight: 1.5,
            fillColor: pal.sea,
            fillOpacity: 0.75,
          })
            .bindTooltip(`M ${q.magnitude} · BMKG`, { direction: 'top' })
            .bindPopup(
              `<strong>M ${q.magnitude}</strong> · ${q.area}<br>${
                q.depth ? `Kedalaman ${q.depth}. ` : ''
              }${q.distanceKm} km dari kawah, ${clockWIB(q.timeISO)} WIB.${
                q.potential ? `<br>${q.potential}` : ''
              }<br><span class="lpop__src">Sumber: BMKG</span>`,
            ),
        )
        focusPoints.push([q.lat, q.lon])
      }

      for (const q of usgsQuakes) {
        const color = q.alert ? (pal.pager[q.alert] ?? pal.watch) : pal.watch
        add(
          L.circleMarker([q.lat, q.lon], {
            radius: magRadius(q.mag),
            color: pal.stroke,
            weight: 1.5,
            fillColor: color,
            fillOpacity: 0.7,
          })
            .bindTooltip(`M ${q.mag.toFixed(1)} · USGS`, { direction: 'top' })
            .bindPopup(
              `<strong>M ${q.mag.toFixed(1)}</strong> · ${q.place}<br>${
                q.depthKm === null ? '' : `Kedalaman ${Math.round(q.depthKm)} km. `
              }${q.distanceKm} km dari kawah, ${clockWIB(q.timeISO)} WIB.${
                q.tsunami ? '<br>Ditandai berpotensi tsunami.' : ''
              }<br><a href="${q.url}" target="_blank" rel="noopener noreferrer">Halaman resmi kejadian →</a>`,
            ),
        )
        focusPoints.push([q.lat, q.lon])
      }
    }

    if (layer === 'pesisir' && volcano.strait) {
      add(
        L.circleMarker([volcano.strait.lat, volcano.strait.lon], {
          radius: 6,
          color: pal.stroke,
          weight: 2,
          fillColor: pal.sea,
          fillOpacity: 0.9,
        })
          .bindTooltip('titik ukur gelombang', { direction: 'top' })
          .bindPopup(
            'Titik pengambilan tinggi gelombang (Open-Meteo Marine). Peringatan tsunami hanya dikeluarkan BMKG — app ini tidak mengeluarkannya.',
          ),
      )
      focusPoints.push([volcano.strait.lat, volcano.strait.lon])
    }

    add(
      L.circleMarker(vent, {
        radius: 7,
        color: pal.stroke,
        weight: 2,
        fillColor: accentColor,
        fillOpacity: 1,
      })
        .bindTooltip(volcano.name, { direction: 'top' })
        .bindPopup(
          `<strong>${volcano.name}</strong><br>${formatCoords(volcano.lat, volcano.lon)} · ${formatNumber(volcano.elevationM)} m<br><span class="lpop__src">Koordinat katalog Smithsonian GVP #${volcano.gvpNumber}</span>`,
        ),
    )

    dataFocusRef.current = focusPoints

    // Pandangan hanya dipas ulang saat yang digambar memang berganti isi:
    // gunung lain, lapisan lain, radius lain. Data yang menetes masuk setelah
    // itu tidak boleh menggeser peta yang sudah diatur pengguna.
    const key = `${volcano.gvpNumber}|${layer}|${radiusKm}`
    const forced = viewKeyRef.current !== key
    viewKeyRef.current = key
    fitToFocus(forced)
    // Sengaja dibandingkan lewat isi, bukan identitas objek — lihat dataKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    volcano,
    radiusKm,
    layer,
    accent,
    ashHeadingDeg,
    windSpeedKmh,
    dataKey,
    tema,
    fitToFocus,
  ])

  // Posisi pengguna digambar terpisah. GPS mengirim titik baru terus-menerus;
  // bila ikut di efek atas, setiap kedipan GPS menghapus dan memasang ulang
  // seluruh bentuk peta.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    geoDrawnRef.current.forEach((item) => map.removeLayer(item))
    geoDrawnRef.current = []
    const pal = readPalette()
    const add = (item: L.Layer) => {
      item.addTo(map)
      geoDrawnRef.current.push(item)
    }

    if (!geo.fix) {
      userFocusRef.current = []
      hadFixRef.current = false
      return
    }

    const me: L.LatLngExpression = [geo.fix.lat, geo.fix.lon]
    const km = distanceKm({ lat: geo.fix.lat, lon: geo.fix.lon }, volcano)
    add(
      L.circle(me, {
        radius: geo.fix.accuracyM,
        color: pal.safe,
        weight: 1,
        opacity: 0.5,
        fillColor: pal.safe,
        fillOpacity: 0.1,
      }),
    )
    // Garis ke kawah kini garis penampang A–B, digambar di efeknya sendiri.
    add(
      L.circleMarker(me, {
        radius: 6,
        color: pal.stroke,
        weight: 2,
        fillColor: pal.safe,
        fillOpacity: 1,
      })
        .bindTooltip('posisi Anda', { direction: 'top' })
        .bindPopup(
          `<strong>Posisi Anda</strong><br>${formatCoords(geo.fix.lat, geo.fix.lon)}<br>${
            km < 10 ? km.toFixed(1) : Math.round(km)
          } km dari kawah · akurasi ${Math.round(geo.fix.accuracyM)} m<br><span class="lpop__src">GPS perangkat Anda</span>`,
        ),
    )
    userFocusRef.current = [me]

    // Hanya titik GPS pertama yang boleh melebarkan pandangan. Sesudah itu
    // pembaruan GPS datang tiap beberapa detik, dan memasang ulang pandangan
    // setiap kali membuat peta bergoyang sendiri.
    if (!hadFixRef.current) {
      hadFixRef.current = true
      fitToFocus(false)
    }
  }, [geo.fix, volcano.lat, volcano.lon, tema, fitToFocus])

  /*
   * Garis penampang A–B. Dibuat sekali, sesudah itu hanya digeser: GPS bergerak
   * tiap beberapa detik, dan membangun ulang lapisannya tiap kali itu membuat
   * garisnya berkedip. Label A dan B digeser sedikit dari titiknya supaya tidak
   * menutupi penanda kawah dan penanda posisi Anda.
   */
  const sectionRef = useRef<{ line: L.Polyline; a: L.Marker; b: L.Marker } | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const color = readPalette().section
    const vent: L.LatLngExpression = [volcano.lat, volcano.lon]
    const end: L.LatLngExpression = [sectionEnd.lat, sectionEnd.lon]
    const current = sectionRef.current
    if (current) {
      current.line.setLatLngs([vent, end])
      current.line.setStyle({ color })
      current.a.setLatLng(vent)
      current.b.setLatLng(end)
      return
    }
    const pin = (text: string, anchor: [number, number]) =>
      L.divIcon({ className: 'secpin', html: text, iconSize: [22, 22], iconAnchor: anchor })
    sectionRef.current = {
      line: L.polyline([vent, end], { color, weight: 3, opacity: 0.9, interactive: false }).addTo(map),
      a: L.marker(vent, { icon: pin('A', [30, 30]), interactive: false, keyboard: false }).addTo(map),
      b: L.marker(end, { icon: pin('B', [-8, 30]), interactive: false, keyboard: false }).addTo(map),
    }
  }, [volcano.lat, volcano.lon, sectionEnd.lat, sectionEnd.lon, tema])

  // Memusatkan ke posisi pengguna tidak boleh menggambar ulang lapisan, jadi
  // dipisah dari efek di atas. Ini pilihan pengguna sendiri, jadi ikut dicatat
  // supaya data yang masuk kemudian tidak menariknya kembali ke kawah.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (focus !== 'saya' || !geo.fix) return
    userMovedRef.current = true
    map.setView([geo.fix.lat, geo.fix.lon], Math.max(map.getZoom(), 11), {
      animate: true,
    })
    // Hanya saat tombolnya ditekan, bukan tiap kedipan GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  const legend = buildLegend({
    layer,
    radiusKm,
    hasPopulation: layer === 'radius' && population !== null,
    hasAdvisory: layer === 'abu' && (advisories ?? []).some((a) => a.polygon),
    hasWind: layer === 'abu' && ashHeadingDeg !== null,
    quakeCount:
      layer === 'gempa' ? bmkgEpicentres.length + usgsQuakes.length : 0,
    hasFix: geo.fix !== null,
  })

  return (
    <div className="lmapwrap">
      <div
        className="lmap"
        ref={hostRef}
        role="application"
        aria-label={`Peta ${volcano.name}`}
      />

      <div className="lmapbase" role="group" aria-label="Peta dasar">
        {BASE_MAPS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`lmapbase__btn${b.id === baseId ? ' lmapbase__btn--on' : ''}`}
            aria-pressed={b.id === baseId}
            onClick={() => setBaseId(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {tilesFailed && (
        <div className="lmapoff" role="status">
          Petak peta tidak bisa dimuat. Yang tampil hanya petak yang tersimpan
          sebelumnya; bentuk di atasnya tetap digambar dari koordinat.
        </div>
      )}

      {legend.length > 0 && (
        <ul className="lmaplegend">
          {legend.map((item) => (
            <li className="lmaplegend__row" key={item.label}>
              <span
                className={`lmaplegend__key lmaplegend__key--${item.shape}`}
                style={{ color: item.color }}
                aria-hidden="true"
              />
              <span className="lmaplegend__label">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface LegendItem {
  shape: 'dot' | 'ring' | 'line' | 'area'
  color: string
  label: string
}

/**
 * Keterangan warna hanya memuat yang benar-benar sedang tergambar.
 *
 * Tidak seperti bentuk di peta, baris-baris ini digambar React sebagai HTML,
 * jadi warnanya cukup menunjuk token dan ikut berganti tema sendiri.
 */
function buildLegend(params: {
  layer: MapLayer['id']
  radiusKm: number
  hasPopulation: boolean
  hasAdvisory: boolean
  hasWind: boolean
  quakeCount: number
  hasFix: boolean
}): LegendItem[] {
  const items: LegendItem[] = [
    {
      shape: 'ring',
      color: 'var(--c-danger)',
      label: `radius pembanding ${params.radiusKm} km`,
    },
  ]
  if (params.hasPopulation) {
    items.push({
      shape: 'ring',
      color: 'var(--c-model)',
      label: 'cincin penduduk WorldPop',
    })
  }
  if (params.hasAdvisory) {
    items.push({
      shape: 'area',
      color: 'var(--c-neutral)',
      label: 'area peringatan abu (SIGMET)',
    })
  }
  if (params.hasWind) {
    items.push({
      shape: 'line',
      color: 'var(--c-alert)',
      label: 'arah angin terukur',
    })
  }
  if (params.quakeCount > 0) {
    items.push({ shape: 'dot', color: 'var(--c-sea)', label: 'episentrum BMKG' })
    items.push({
      shape: 'dot',
      color: 'var(--c-watch)',
      label: 'episentrum USGS',
    })
  }
  if (params.hasFix) {
    items.push({ shape: 'dot', color: 'var(--c-safe)', label: 'posisi Anda' })
  }
  return items
}
