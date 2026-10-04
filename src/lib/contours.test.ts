import assert from 'node:assert/strict'
import { test } from 'node:test'
import { contourRings } from './contours.ts'

const opts = { rings: 7, cx: 100, cy: 100, minR: 14, maxR: 96, seed: 7 }

test('motifnya tetap: benih yang sama memberi garis yang sama', () => {
  assert.deepEqual(
    contourRings(opts).map((r) => r.d),
    contourRings(opts).map((r) => r.d),
  )
})

test('setiap cincin tertutup dan jumlahnya sesuai', () => {
  const rings = contourRings(opts)
  assert.equal(rings.length, 7)
  for (const r of rings) assert.ok(r.d.startsWith('M') && r.d.endsWith('Z'))
})

test('garis kontur tidak pernah bersilangan', () => {
  // Cincin luar harus di luar cincin dalam pada setiap sudut, seperti kontur
  // sungguhan. Ini yang membuat motifnya terbaca sebagai lereng, bukan coretan.
  const rings = contourRings(opts)
  for (let k = 1; k < rings.length; k++) {
    rings[k].radii.forEach((rho, i) => {
      assert.ok(
        rho > rings[k - 1].radii[i],
        `cincin ${k} menyentuh cincin ${k - 1} di titik ${i}`,
      )
    })
  }
})
