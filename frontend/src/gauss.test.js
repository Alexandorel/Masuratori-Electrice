// Rulare: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { netezeste } from './gauss.js'

test('sigma 0 lasa valorile neschimbate', () => {
  const v = [1, 5, 2]
  assert.equal(netezeste(v, 0), v)
})

test('o linie constanta ramane constanta, inclusiv la margini', () => {
  for (const x of netezeste([230, 230, 230, 230, 230], 2)) assert.ok(Math.abs(x - 230) < 1e-9)
})

test('un varf izolat se aplatizeaza si se imparte vecinilor', () => {
  const r = netezeste([0, 0, 0, 100, 0, 0, 0], 1)
  assert.ok(r[3] < 50 && r[3] > 0)
  assert.ok(r[2] > 0 && Math.abs(r[2] - r[4]) < 1e-9)  // simetric
})

test('golurile raman goluri si nu trag media spre 0', () => {
  const r = netezeste([10, null, 10, 10], 1)
  assert.equal(r[1], null)
  assert.ok(Math.abs(r[0] - 10) < 1e-9)
})
