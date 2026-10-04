import assert from 'node:assert/strict'
import { test } from 'node:test'
import { seismotrace } from './seismotrace.ts'

const ys = (d: string) =>
  [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => Number(m[2]))
const xs = (d: string) =>
  [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => Number(m[1]))

test('jam tanpa gempa digambar benar-benar datar', () => {
  // Tidak ada getaran latar karangan untuk membuat jam sepi terlihat hidup.
  const t = seismotrace(new Array(24).fill(0), 240, 40)
  assert.ok(ys(t.d).every((y) => y === 20))
  assert.equal(t.peak, 0)
})

test('jam tersibuk menyentuh batas tinggi, tidak lebih', () => {
  const hourly = new Array(24).fill(0)
  hourly[5] = 300
  hourly[9] = 150
  const t = seismotrace(hourly, 240, 40)
  assert.equal(t.peak, 19)
  for (const y of ys(t.d)) assert.ok(y >= 0 && y <= 40)
})

test('tinggi sebanding dengan jumlah kejadian', () => {
  const t1 = seismotrace([0, 100, 0, 50], 80, 42)
  const amps: number[] = []
  // Simpangan terbesar tiap slot jam.
  const pts = [...t1.d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
  for (let s = 0; s < 4; s++) {
    const inSlot = pts.filter(([x]) => x > s * 20 && x < (s + 1) * 20)
    amps.push(Math.max(0, ...inSlot.map(([, y]) => Math.abs(21 - y))))
  }
  assert.equal(amps[0], 0)
  assert.equal(amps[2], 0)
  assert.ok(Math.abs(amps[1] / amps[3] - 2) < 0.05, `rasio ${amps[1] / amps[3]}`)
})

test('satu kejadian tetap terlihat walau puncak harinya ratusan', () => {
  const hourly = new Array(24).fill(0)
  hourly[0] = 400
  hourly[20] = 1
  const pts = [...seismotrace(hourly, 240, 40).d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)]
    .map((m) => [Number(m[1]), Number(m[2])])
  const slot20 = pts.filter(([x]) => x > 200 && x < 210)
  assert.ok(slot20.some(([, y]) => Math.abs(20 - y) >= 1.5))
})

test('data rusak tidak menghasilkan NaN', () => {
  const t = seismotrace([Number.NaN, -3, 2, Number.POSITIVE_INFINITY], 40, 20)
  assert.ok(!t.d.includes('NaN') && !t.d.includes('Infinity'))
  assert.ok(xs(t.d).every((x) => x >= 0 && x <= 40))
})

test('tanpa data sama sekali tetap garis datar yang sah', () => {
  const t = seismotrace([], 100, 20)
  assert.equal(t.d, 'M0 10.0')
})
