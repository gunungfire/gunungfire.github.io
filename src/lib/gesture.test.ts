import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dragHeight, lockAxis, pickSnap, rubberBand, swipeStep, velocity } from './gesture.ts'

const SNAPS = [348, 490, 690]

test('sumbu belum diputuskan sebelum jari bergeser cukup jauh', () => {
  assert.equal(lockAxis(3, 4), null)
  assert.equal(lockAxis(20, 2), 'x')
  assert.equal(lockAxis(2, -20), 'y')
})

test('gerakan miring dianggap tegak — niat menggulir lebih umum', () => {
  assert.equal(lockAxis(10, 10), 'y')
  assert.equal(lockAxis(11, 10), 'y')
  assert.equal(lockAxis(13, 10), 'x')
})

test('lentur: di dalam batas apa adanya, di luar makin berat dan terbatas', () => {
  assert.equal(rubberBand(400, 348, 690), 400)
  const a = rubberBand(338, 348, 690)
  const b = rubberBand(248, 348, 690)
  assert.ok(a < 348 && a > 338, 'sedikit melewati, sedikit bergerak')
  assert.ok(b < a, 'lebih jauh tetap bergerak')
  assert.ok(348 - b < 100 - 1, 'tapi lebih lambat dari jari')
  assert.ok(rubberBand(-1e6, 348, 690) > 348 - 80, 'tidak pernah lewat batas lentur')
  assert.ok(rubberBand(1e6, 348, 690) < 690 + 80)
})

test('kecepatan dari sampel terakhir, nol bila jari sudah diam', () => {
  const s = [
    { t: 0, v: 0 },
    { t: 16, v: 10 },
    { t: 32, v: 30 },
    { t: 48, v: 60 },
  ]
  assert.ok(Math.abs(velocity(s, 50) - 60 / 48) < 1e-9)
  assert.equal(velocity(s, 400), 0)
  assert.equal(velocity([{ t: 0, v: 5 }], 0), 0)
})

test('kecepatan hanya dari jendela terakhir, bukan awal tarikan', () => {
  const s = [
    { t: 0, v: 0 },
    { t: 500, v: 0 },
    { t: 516, v: 20 },
    { t: 532, v: 40 },
  ]
  assert.ok(Math.abs(velocity(s, 532) - 40 / 32) < 1e-9)
})

test('tanpa lemparan, jepret terdekat', () => {
  assert.equal(pickSnap(SNAPS, 400, 0), 0)
  assert.equal(pickSnap(SNAPS, 430, 0), 1)
  assert.equal(pickSnap(SNAPS, 650, 0), 2)
})

test('lemparan kecil dari dekat jepret tetap berpindah satu langkah', () => {
  assert.equal(pickSnap(SNAPS, 360, 0.5), 1)
  assert.equal(pickSnap(SNAPS, 500, 0.5), 2)
  assert.equal(pickSnap(SNAPS, 480, -0.5), 0)
  assert.equal(pickSnap(SNAPS, 680, -0.5), 1)
})

test('lemparan sedang berpindah tepat satu jepret, tidak melompat', () => {
  assert.equal(pickSnap(SNAPS, 630, -1.3), 1)
  assert.equal(pickSnap(SNAPS, 400, 1.3), 1)
})

test('lemparan sangat kuat boleh melompati jepret tengah', () => {
  assert.equal(pickSnap(SNAPS, 360, 3), 2)
  assert.equal(pickSnap(SNAPS, 680, -3), 0)
})

test('lemparan di ujung tidak keluar dari daftar', () => {
  assert.equal(pickSnap(SNAPS, 700, 2), 2)
  assert.equal(pickSnap(SNAPS, 330, -2), 0)
})

test('tarikan biasa mengikuti jari', () => {
  assert.deepEqual(dragHeight(SNAPS, 490, -50, 0, true), { height: 540, scrollTop: 0 })
  assert.deepEqual(dragHeight(SNAPS, 490, 60, 120, true), { height: 430, scrollTop: 120 })
})

test('dari isi, tarikan melewati penuh diteruskan menggulir', () => {
  assert.deepEqual(dragHeight(SNAPS, 490, -260, 30, true), { height: 690, scrollTop: 90 })
})

test('dari gagang, melewati penuh hanya lentur, tidak menggulir', () => {
  const r = dragHeight(SNAPS, 490, -260, 30, false)
  assert.ok(r.height > 690 && r.height < 690 + 24)
  assert.equal(r.scrollTop, 30)
})

test('di bawah jepret terendah lentur', () => {
  const r = dragHeight(SNAPS, 348, 200, 0, true)
  assert.ok(r.height < 348 && r.height > 348 - 60)
})

test('geser tab: cukup jauh atau cukup cepat', () => {
  assert.equal(swipeStep(-120, 0, 390), 1)
  assert.equal(swipeStep(120, 0, 390), -1)
  assert.equal(swipeStep(-60, 0, 390), 0)
  assert.equal(swipeStep(-60, -0.6, 390), 1)
  assert.equal(swipeStep(60, 0.6, 390), -1)
})

test('lemparan yang berbalik arah atau terlalu pendek tidak berpindah tab', () => {
  assert.equal(swipeStep(-60, 0.6, 390), 0)
  assert.equal(swipeStep(-20, -1, 390), 0)
})
