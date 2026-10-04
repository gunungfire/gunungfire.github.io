import assert from 'node:assert/strict'
import { test } from 'node:test'
import { VOLCANOES } from './volcanoes.ts'
import {
  namesSameVolcano,
  RIDGE_SCROLL_FROM,
  ridgeItems,
  ridgeSummary,
  shortName,
} from './ridge.ts'

// Daftar nasional apa adanya dari feed SIGMET run CI #63.
const NASIONAL = { volcanoes: ['DUKONO', 'IBU', 'KRAKATAU', 'LEWOTOLOK', 'SEMERU'] }

test('urut dari barat ke timur menurut bujur', () => {
  const items = ridgeItems({ volcanoes: VOLCANOES, selectedId: 'sinabung', selectedAviation: 'clear', national: NASIONAL })
  assert.deepEqual(
    items.map((i) => i.id),
    ['sinabung', 'krakatau', 'semeru', 'lewotobi', 'lewotolok', 'ibu', 'dukono'],
  )
})

test('nama pendek SIGMET menunjuk nama lengkap di registri', () => {
  assert.equal(namesSameVolcano('Anak Krakatau', 'KRAKATAU'), true)
  assert.equal(namesSameVolcano('Ili Lewotolok', 'LEWOTOLOK'), true)
  assert.equal(namesSameVolcano('Lewotobi Laki-laki', 'LEWOTOBI LAKI-LAKI'), true)
  assert.equal(namesSameVolcano('Lewotobi Laki-laki', 'LEWOTOBI'), true)
})

test('kata umum saja tidak menunjuk gunung mana pun', () => {
  assert.equal(namesSameVolcano('Anak Krakatau', 'ANAK'), false)
  assert.equal(namesSameVolcano('Ili Lewotolok', 'ILI'), false)
  assert.equal(namesSameVolcano('Anak Krakatau', 'ANAK KRAKATAU'), true)
  assert.equal(namesSameVolcano('Ili Lewotolok', 'LEWOTOBI'), false)
  assert.equal(namesSameVolcano('Ibu', 'IBU KOTA'), false)
  assert.equal(namesSameVolcano('Semeru', ''), false)
})

test('status abu dari daftar nasional run #63', () => {
  const items = ridgeItems({ volcanoes: VOLCANOES, selectedId: 'sinabung', selectedAviation: 'clear', national: NASIONAL })
  const byId = Object.fromEntries(items.map((i) => [i.id, i.ash]))
  assert.equal(byId.sinabung, 'tidak')
  assert.equal(byId.lewotobi, 'tidak')
  for (const id of ['krakatau', 'semeru', 'lewotolok', 'ibu', 'dukono']) assert.equal(byId[id], 'ada')
  assert.deepEqual(ridgeSummary(items), { total: 7, withAsh: 5, incomplete: false })
})

test('gunung terpilih memakai peringatan yang menyebut namanya', () => {
  const items = ridgeItems({ volcanoes: VOLCANOES, selectedId: 'sinabung', selectedAviation: 'active', national: NASIONAL })
  assert.equal(items.find((i) => i.id === 'sinabung')?.ash, 'ada')
})

test('abu di dekat tapi bukan dari gunung ini tidak dihitung sebagai abunya', () => {
  const items = ridgeItems({ volcanoes: VOLCANOES, selectedId: 'sinabung', selectedAviation: 'nearby', national: NASIONAL })
  assert.equal(items.find((i) => i.id === 'sinabung')?.ash, 'tidak')
})

test('feed gagal dibaca berarti tidak diketahui, bukan tidak ada', () => {
  const items = ridgeItems({ volcanoes: VOLCANOES, selectedId: 'sinabung', selectedAviation: 'unknown', national: null })
  assert.ok(items.every((i) => i.ash === 'tak terbaca'))
  const s = ridgeSummary(items)
  assert.equal(s.withAsh, 0)
  assert.equal(s.incomplete, true)
})

test('nama pendek muat di bawah kerucut', () => {
  assert.equal(shortName('Anak Krakatau'), 'Krakatau')
  assert.equal(shortName('Ili Lewotolok'), 'Lewotolok')
  assert.equal(shortName('Lewotobi Laki-laki'), 'Lewotobi')
  assert.equal(shortName('Semeru'), 'Semeru')
})

test('cakrawala mulai bisa digeser pada 6 gunung', () => {
  assert.equal(RIDGE_SCROLL_FROM, 6)
})
