import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INFO_ORDER, INFO_TITLE, infoSummaries, type InfoSummaryInput } from './infoSummary.ts'

// Nilai Sinabung dari run CI #63.
const SINABUNG: InfoSummaryInput = {
  aviationShort: 'tidak ada peringatan aktif',
  aviationAction: 'Tidak ada pembatasan dari peringatan abu',
  national: { total: 5 },
  position: null,
  radiusKm: 5,
  aqi: 67,
  windDirection: 'Barat daya',
  windSample: false,
  seismicHourly: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  seismicSample: false,
  population: { rings: [{ radiusKm: 30, people: 479170 }, { radiusKm: 5, people: 14444 }, { radiusKm: 10, people: 68371 }] },
  feedCount: 3,
}

test('setiap bagian punya judul dan ringkasan', () => {
  const s = infoSummaries(SINABUNG)
  for (const id of INFO_ORDER) {
    assert.ok(INFO_TITLE[id])
    assert.ok(s[id] && s[id].length > 0, id)
  }
  assert.equal(new Set(INFO_ORDER).size, 8)
})

test('ringkasan memakai angka sungguhan dengan pemisah Indonesia', () => {
  const s = infoSummaries(SINABUNG)
  assert.equal(s.abu, 'Tidak ada peringatan aktif · 5 aktif se-Indonesia')
  assert.equal(s.gempa, '2 kejadian dalam 24 jam')
  // Cincin terdekat dipakai walau urutan masuknya acak.
  assert.equal(s.wilayah, '14.444 jiwa dalam 5 km dari kawah')
  assert.equal(s.udara, 'AQI 67, sedang · abu ke barat daya')
})

test('yang belum terbaca dikatakan belum terbaca, bukan nol', () => {
  const s = infoSummaries({ ...SINABUNG, aqi: null, population: null, national: null, feedCount: 0 })
  assert.match(s.udara, /^Kualitas udara belum terbaca/)
  assert.equal(s.wilayah, 'Perkiraan penduduk belum terbaca')
  assert.equal(s.abu, 'Tidak ada peringatan aktif')
  assert.equal(s.laporan, 'Belum ada kabar')
  for (const v of Object.values(s)) assert.doesNotMatch(v, /\b0 (jiwa|kejadian)/)
})

test('data contoh dikatakan contoh', () => {
  const s = infoSummaries({ ...SINABUNG, seismicSample: true, windSample: true, windDirection: 'Barat laut' })
  assert.match(s.gempa, /contoh/)
  assert.doesNotMatch(s.gempa, /\d+ kejadian/)
  assert.match(s.udara, /barat laut \(contoh\)/)
})

test('posisi menyebut jarak dan vonis zona', () => {
  const s = infoSummaries({ ...SINABUNG, position: { km: 3.24, verdict: 'di dalam' } })
  assert.equal(s.posisi, '3,2 km dari kawah, di dalam radius 5 km')
  const jauh = infoSummaries({ ...SINABUNG, position: { km: 41.6, verdict: 'di luar' } })
  assert.equal(jauh.posisi, '42 km dari kawah, di luar radius 5 km')
  assert.equal(infoSummaries(SINABUNG).posisi, 'Lokasi belum aktif')
})
