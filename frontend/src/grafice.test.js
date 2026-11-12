// Rulare: node src/grafice.test.js  (fara biblioteci de test; daca nu apare nicio eroare, totul e bine)
import assert from 'node:assert/strict'
import { consum, grupeazaPeUnitati, pasConsum, puncte, rareste } from './grafice.js'

const r = (timp, valori) => ({ timp, valori })

// Consumul pe ore: cresterea dintre 10:59 si 11:01 intra la ora 11, scaderea (reset) se ignora.
const date = [
  r('2026-11-12T10:00:00', { Ea_tot_kWh: 100 }),
  r('2026-11-12T10:59:00', { Ea_tot_kWh: 101.5 }),
  r('2026-11-12T11:01:00', { Ea_tot_kWh: 102 }),
  r('2026-11-12T11:30:00', { Ea_tot_kWh: null }),
  r('2026-11-12T11:40:00', { Ea_tot_kWh: 50 }),
  r('2026-11-12T11:50:00', { Ea_tot_kWh: 51 }),
]
assert.deepEqual(consum(date, 'ora'), [
  { cheie: '2026-11-12T10', kWh: 1.5 },
  { cheie: '2026-11-12T11', kWh: 1.5 },
])
assert.deepEqual(consum(date, 'zi'), [{ cheie: '2026-11-12', kWh: 3 }])

assert.equal(pasConsum(date), 'ora')
assert.equal(pasConsum([r('2026-11-01T00:00:00', {}), r('2026-11-12T00:00:00', {})]), 'zi')

// Raritul pastreaza primul si ultimul punct si nu depaseste limita (+1 pentru ultimul).
const multe = Array.from({ length: 10001 }, (_, i) => i)
const rar = rareste(multe, 800)
assert.ok(rar.length <= 801 && rar[0] === 0 && rar.at(-1) === 10000)
assert.equal(rareste([1, 2, 3], 800).length, 3)

// Valorile care nu sunt numere devin null (gol in linie), nu 0.
assert.deepEqual(puncte([r('2026-11-12T10:00:00', { P: 5, U1N: 'x' })], ['P', 'U1N']).map((p) => [p.P, p.U1N]), [[5, null]])

assert.deepEqual(
  grupeazaPeUnitati(['P', 'U1N', 'Q', 'U2N'], [
    { cod: 'P', unitate: 'W' }, { cod: 'Q', unitate: 'var' }, { cod: 'U1N', unitate: 'V' }, { cod: 'U2N', unitate: 'V' },
  ]),
  [{ unitate: 'W', coduri: ['P'] }, { unitate: 'V', coduri: ['U1N', 'U2N'] }, { unitate: 'var', coduri: ['Q'] }],
)

console.log('grafice.js: OK')
