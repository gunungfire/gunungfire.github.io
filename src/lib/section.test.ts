import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bearingDeg, destinationPoint, distanceKm } from './geo.ts'
import {
  ashAlongSection,
  coneAltitudeKm,
  coneFootKm,
  FALLBACK_BEARING_DEG,
  flightLevels,
  kmTicks,
  MAX_ALT_KM,
  MIN_ALT_KM,
  MIN_SPAN_KM,
  sectionLine,
  sectionScale,
} from './section.ts'

const SINABUNG = { lat: 3.17, lon: 98.392 }

test('dengan GPS, garis menuju pengguna dan B adalah posisinya', () => {
  const me = destinationPoint(SINABUNG, 112, 12)
  const s = sectionLine(SINABUNG, me, 200)
  assert.equal(s.basis, 'gps')
  assert.ok(Math.abs(s.bearingDeg - bearingDeg(SINABUNG, me)) < 1e-9)
  assert.ok(Math.abs((s.userKm ?? 0) - 12) < 0.01)
  assert.deepEqual(s.end, me)
  assert.equal(s.spanKm, 30)
  assert.equal(s.userOffScale, false)
})

test('bentang melebar mengikuti pengguna, ke angka rapi', () => {
  const me = destinationPoint(SINABUNG, 40, 47)
  const s = sectionLine(SINABUNG, me, null)
  // 47 km x 1,15 = 54 → 60.
  assert.equal(s.spanKm, 60)
  assert.ok(s.spanKm >= (s.userKm ?? 0))
})

test('pengguna di pulau lain tidak memipihkan gunungnya', () => {
  const jakarta = { lat: -6.2, lon: 106.8 }
  const s = sectionLine(SINABUNG, jakarta, null)
  assert.equal(s.userOffScale, true)
  assert.equal(s.spanKm, MIN_SPAN_KM)
  assert.ok(Math.abs(distanceKm(SINABUNG, s.end) - MIN_SPAN_KM) < 0.01)
  assert.ok((s.userKm ?? 0) > 1000)
})

test('tanpa GPS, garis mengikuti arah sebaran abu', () => {
  const s = sectionLine(SINABUNG, null, 225)
  assert.equal(s.basis, 'angin')
  assert.equal(s.bearingDeg, 225)
  assert.equal(s.userKm, null)
  assert.ok(Math.abs(distanceKm(SINABUNG, s.end) - MIN_SPAN_KM) < 0.01)
})

test('tanpa GPS dan tanpa angin, garis ke timur dan dinyatakan begitu', () => {
  const s = sectionLine(SINABUNG, null, null)
  assert.equal(s.basis, 'tetap')
  assert.equal(s.bearingDeg, FALLBACK_BEARING_DEG)
})

test('skala tegak memuat awan abu dan dilebihkan sedikitnya 1 kali', () => {
  const base = { spanKm: 30, width: 390, groundY: 250, leftPx: 60, rightPx: 26 }
  const calm = sectionScale({ ...base, ashTopKm: null })
  assert.equal(calm.altKm, MIN_ALT_KM)
  assert.ok(calm.exaggeration >= 1 && Number.isInteger(calm.exaggeration))

  const high = sectionScale({ ...base, ashTopKm: 10.4 })
  assert.equal(high.altKm, 12)

  const extreme = sectionScale({ ...base, ashTopKm: 30 })
  assert.equal(extreme.altKm, MAX_ALT_KM)
})

test('pelebihan skala tegak sesuai perbandingan piksel per km', () => {
  const s = sectionScale({ spanKm: 30, ashTopKm: null, width: 390, groundY: 250, leftPx: 60, rightPx: 30 })
  // Mendatar 300/30 = 10 px/km, tegak 250/8 = 31,25 px/km.
  assert.equal(s.pxX, 10)
  assert.equal(s.pxY, 31.25)
  assert.equal(s.exaggeration, 3)
})

test('tanda jarak rapi dan tidak melewati bentang', () => {
  assert.deepEqual(kmTicks(30), [10, 20, 30])
  assert.deepEqual(kmTicks(60), [20, 40, 60])
  assert.deepEqual(kmTicks(100), [25, 50, 75, 100])
  for (const t of kmTicks(120)) assert.ok(t <= 120)
})

test('flight level hanya yang muat di penampang', () => {
  assert.deepEqual(flightLevels(8).map((f) => f.fl), [100, 200])
  assert.deepEqual(flightLevels(12).map((f) => f.fl), [100, 200, 300])
  // FL200 = 20.000 kaki = 6,096 km: ketinggian yang dipakai SIGMET sendiri.
  assert.ok(Math.abs(flightLevels(8)[1].km - 6.096) < 1e-9)
})

test('kerucut setinggi puncak di kawah, nol di kaki, menurun di antaranya', () => {
  const summit = 2.46
  assert.equal(coneAltitudeKm(0, summit), summit)
  assert.equal(coneAltitudeKm(coneFootKm(summit), summit), 0)
  assert.equal(coneAltitudeKm(50, summit), 0)
  let prev = Infinity
  for (let d = 0; d <= coneFootKm(summit); d += 0.25) {
    const h = coneAltitudeKm(d, summit)
    assert.ok(h <= prev)
    prev = h
  }
  // Simetris: lereng di belakang kawah sama dengan di depan.
  assert.equal(coneAltitudeKm(-1.5, summit), coneAltitudeKm(1.5, summit))
})

/** Persegi di sekitar satu titik, sebagai [lintang, bujur] seperti SIGMET. */
function boxAround(center: { lat: number; lon: number }, halfKm: number): [number, number][] {
  const n = destinationPoint(center, 0, halfKm).lat - center.lat
  const e = destinationPoint(center, 90, halfKm).lon - center.lon
  return [
    [center.lat - n, center.lon - e],
    [center.lat - n, center.lon + e],
    [center.lat + n, center.lon + e],
    [center.lat + n, center.lon - e],
  ]
}

test('awan abu digambar tepat di bagian garis yang memotong poligon', () => {
  // Poligon 10 km persegi berpusat 15 km di timur kawah: memotong garis timur
  // dari sekitar km 10 sampai km 20.
  const center = destinationPoint(SINABUNG, 90, 15)
  const spans = ashAlongSection({
    vent: SINABUNG,
    bearingDeg: 90,
    spanKm: 30,
    behindKm: 6,
    advisory: { polygon: boxAround(center, 5), topM: 6100, baseFt: 0 },
  })
  assert.equal(spans.length, 1)
  assert.ok(Math.abs(spans[0].fromKm - 10) <= 0.5, `dari ${spans[0].fromKm}`)
  assert.ok(Math.abs(spans[0].toKm - 20) <= 0.5, `sampai ${spans[0].toKm}`)
  assert.equal(spans[0].topKm, 6.1)
  assert.equal(spans[0].baseKm, 0)
})

test('peringatan yang tidak memotong garis tidak digambar di penampang', () => {
  // Poligon di barat, garis ke timur sejauh 30 km, belakang kawah 6 km.
  const west = destinationPoint(SINABUNG, 270, 40)
  const spans = ashAlongSection({
    vent: SINABUNG,
    bearingDeg: 90,
    spanKm: 30,
    behindKm: 6,
    advisory: { polygon: boxAround(west, 5), topM: 6100, baseFt: 0 },
  })
  assert.deepEqual(spans, [])
})

test('dasar awan dari kaki diubah ke km', () => {
  const spans = ashAlongSection({
    vent: SINABUNG,
    bearingDeg: 90,
    spanKm: 30,
    behindKm: 6,
    advisory: { polygon: boxAround(SINABUNG, 8), topM: 9100, baseFt: 10000 },
  })
  assert.ok(spans.length >= 1)
  assert.ok(Math.abs(spans[0].baseKm - 3.048) < 1e-9)
  // Poligon mengelilingi kawah: ikut tercatat di belakang kawah juga.
  assert.ok(spans[0].fromKm < 0)
})

test('peringatan tanpa poligon atau tanpa puncak tidak bisa digambar ke skala', () => {
  const base = { vent: SINABUNG, bearingDeg: 90, spanKm: 30, behindKm: 6 }
  assert.deepEqual(ashAlongSection({ ...base, advisory: { polygon: null, topM: 6100, baseFt: 0 } }), [])
  assert.deepEqual(
    ashAlongSection({ ...base, advisory: { polygon: boxAround(SINABUNG, 5), topM: null, baseFt: 0 } }),
    [],
  )
})
