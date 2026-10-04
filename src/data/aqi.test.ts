import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AQI_BANDS, aqiBand, aqiFromPm25 } from './aqi.ts'

test('titik patah tabel EPA dipetakan tepat ke batas kategorinya', () => {
  // Kalau interpolasinya meleset, angka di batas kategori akan berpindah
  // kategori dan sarannya ikut salah.
  assert.equal(aqiFromPm25(0), 0)
  assert.equal(aqiFromPm25(9.0), 50)
  assert.equal(aqiFromPm25(9.1), 51)
  assert.equal(aqiFromPm25(35.4), 100)
  assert.equal(aqiFromPm25(35.5), 101)
  assert.equal(aqiFromPm25(55.4), 150)
  assert.equal(aqiFromPm25(125.4), 200)
  assert.equal(aqiFromPm25(225.4), 300)
})

test('konsentrasi dipotong ke satu desimal seperti aturan EPA', () => {
  // 9.09 masih masuk kategori pertama karena EPA memotong, bukan membulatkan.
  assert.equal(aqiFromPm25(9.09), 50)
  assert.equal(aqiFromPm25(9.19), 51)
})

test('nilai di luar tabel dikembalikan null, bukan dipaksa ke ujung skala', () => {
  // AQI 500 yang sebenarnya tidak terdefinisi akan terbaca sebagai bencana
  // yang terukur. Lebih baik indeksnya hilang.
  assert.equal(aqiFromPm25(400), null)
  assert.equal(aqiFromPm25(-1), null)
  assert.equal(aqiFromPm25(Number.NaN), null)
})

test('kategori dipilih dari batas atas indeks', () => {
  assert.equal(aqiBand(50).label, 'Baik')
  assert.equal(aqiBand(51).label, 'Sedang')
  assert.equal(aqiBand(138).label, 'Tidak sehat bagi kelompok sensitif')
  assert.equal(aqiBand(200).label, 'Tidak sehat')
  assert.equal(aqiBand(301).label, 'Berbahaya')
})

test('warna setiap kategori adalah token, bukan kode warna mati', () => {
  // Kode warna mati tidak ikut berganti tema: kuning "Sedang" pernah 1,3:1
  // di atas putih dan tak terbaca di tema terang.
  for (const band of AQI_BANDS) {
    assert.match(band.color, /^var\(--c-[a-z]+\)$/, `${band.label}: ${band.color}`)
  }
})
