import assert from 'node:assert/strict'
import { test } from 'node:test'
import { VOLCANOES } from '../data/volcanoes.ts'
import { GLYPH_BASE_Y, GLYPH_H, GLYPH_W, ridgeGlyph } from './ridgeGlyph.ts'

/** Semua titik di sebuah path, sebagai pasangan [x, y]. */
function points(d: string): [number, number][] {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]])
  return out
}

function inside(d: string) {
  return points(d).every(([x, y]) => x >= 0 && x <= GLYPH_W && y >= 0 && y <= GLYPH_H)
}

const maxM = Math.max(...VOLCANOES.map((v) => v.elevationM))

test('gunung tertinggi beserta kepulannya muat di kotak ikon', () => {
  const g = ridgeGlyph(maxM, maxM)
  assert.ok(inside(g.cone), g.cone)
  assert.ok(inside(g.puff), g.puff)
  assert.ok(Math.min(...points(g.puff).map(([, y]) => y)) >= 1, 'ada ruang di atas kepulan')
})

test('setiap gunung di registri muat, dengan atau tanpa kepulan', () => {
  for (const v of VOLCANOES) {
    const g = ridgeGlyph(v.elevationM, maxM)
    assert.ok(inside(g.cone), `${v.name} kerucut`)
    assert.ok(inside(g.puff), `${v.name} kepulan`)
  }
})

test('lebih tinggi berarti puncak lebih atas', () => {
  const low = ridgeGlyph(1000, 3676)
  const high = ridgeGlyph(3000, 3676)
  assert.ok(high.topY < low.topY)
})

test('ketinggian aneh tidak merusak bentuk', () => {
  for (const [e, m] of [[0, 3676], [-50, 3676], [5000, 3676], [1000, 0]]) {
    const g = ridgeGlyph(e, m)
    assert.ok(inside(g.cone) && inside(g.puff), `${e}/${m}`)
    assert.ok(g.topY < GLYPH_BASE_Y)
  }
})
