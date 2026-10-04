import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveAviationStatus } from './aviation.ts'
import type { AshAdvisory } from '../types.ts'

const advisory = (namedHere: boolean): AshAdvisory => ({
  fir: 'WIIF JAKARTA',
  validFromISO: null,
  validToISO: null,
  topFt: 18000,
  topM: 5486,
  baseFt: 0,
  moveDir: 'W',
  moveSpeedKt: 20,
  distanceKm: 42,
  polygon: null,
  namedHere,
  qualifier: namedHere ? 'KRAKATAU' : 'SEMERU',
  validity: 'berlaku' as const,
  moveDirLabel: 'Barat',
  text: 'WVID01 WIIF 070640 VA ERUPTION',
})

test('sumber yang gagal dibedakan dari tidak ada peringatan', () => {
  // Keduanya sama-sama "tidak ada angka", tapi artinya berlawanan: yang satu
  // berarti aman, yang satu berarti kita tidak tahu.
  const gagal = resolveAviationStatus(null, 'Semeru')
  const kosong = resolveAviationStatus([], 'Semeru')
  assert.equal(gagal.id, 'unknown')
  assert.equal(kosong.id, 'clear')
  assert.notEqual(gagal.colors.color, kosong.colors.color)
})

test('peringatan yang menyebut gunung ini menaikkan pita peringatan', () => {
  const status = resolveAviationStatus([advisory(true)], 'Anak Krakatau')
  assert.equal(status.id, 'active')
  assert.equal(status.urgent, true)
  assert.ok(status.strip.includes('Anak Krakatau'))
})

test('peringatan tetangga tidak boleh terbaca sebagai peringatan gunung ini', () => {
  // Satu SIGMET untuk gunung lain di FIR yang sama tidak boleh membuat layar
  // gunung ini berteriak.
  const status = resolveAviationStatus([advisory(false), advisory(false)], 'Ibu')
  assert.equal(status.id, 'nearby')
  assert.equal(status.urgent, false)
  assert.equal(status.strip, '')
})

test('satu peringatan yang menyebut gunung ini cukup, walau ada yang lain', () => {
  const status = resolveAviationStatus(
    [advisory(false), advisory(true)],
    'Dukono',
  )
  assert.equal(status.id, 'active')
})

test('tidak ada keadaan yang memakai nama warna resmi sebagai kata besarnya', () => {
  // Aviation colour code hanya sah dari Badan Geologi. Kalau kata besar di
  // kartu berbunyi ORANGE atau RED, pembaca akan mengira ini kode resmi.
  const terlarang = ['GREEN', 'YELLOW', 'ORANGE', 'RED']
  for (const status of [
    resolveAviationStatus(null, 'Sinabung'),
    resolveAviationStatus([], 'Sinabung'),
    resolveAviationStatus([advisory(false)], 'Sinabung'),
    resolveAviationStatus([advisory(true)], 'Sinabung'),
  ]) {
    assert.ok(
      !terlarang.includes(status.name),
      `kata besar "${status.name}" meniru aviation colour code resmi`,
    )
    // Jawaban di layar Status tunduk pada aturan yang sama.
    const kata = status.verdict.toUpperCase().replace(/[^A-Z ]/g, '').split(' ')
    assert.ok(
      !kata.some((k) => terlarang.includes(k)),
      `jawaban "${status.verdict}" meniru aviation colour code resmi`,
    )
  }
})

test('setiap keadaan punya jawaban yang berbeda', () => {
  const verdicts = [
    resolveAviationStatus(null, 'Sinabung'),
    resolveAviationStatus([], 'Sinabung'),
    resolveAviationStatus([advisory(false)], 'Sinabung'),
    resolveAviationStatus([advisory(true)], 'Sinabung'),
  ].map((s) => s.verdict)
  assert.equal(new Set(verdicts).size, 4)
  // Sumber yang gagal dibaca tidak boleh terdengar seperti keadaan aman.
  assert.notEqual(resolveAviationStatus(null, 'Sinabung').verdict, 'Bersih.')
})

test('peringatan yang jendelanya sudah lewat tidak menaikkan status', () => {
  // Kabar kemarin tidak boleh membuat layar berteriak hari ini.
  const lewat = { ...advisory(true), validity: 'lewat' as const }
  const status = resolveAviationStatus([lewat], 'Anak Krakatau')
  assert.equal(status.id, 'clear')
  assert.equal(status.urgent, false)
})

test('peringatan yang belum mulai tetap dihitung sebagai kabar aktif', () => {
  // Berbeda dengan yang sudah lewat: ini pemberitahuan ke depan, bukan arsip.
  const akan = { ...advisory(true), validity: 'akan' as const }
  assert.equal(resolveAviationStatus([akan], 'Anak Krakatau').id, 'active')
})

test('semua peringatan lewat sama artinya dengan tidak ada peringatan', () => {
  const lewat = [
    { ...advisory(false), validity: 'lewat' as const },
    { ...advisory(true), validity: 'lewat' as const },
  ]
  assert.equal(resolveAviationStatus(lewat, 'Ibu').id, 'clear')
  // Tapi sumber yang gagal tetap berbeda dari itu.
  assert.equal(resolveAviationStatus(null, 'Ibu').id, 'unknown')
})
