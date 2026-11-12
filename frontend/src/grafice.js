// Calculele din spatele graficelor (fara React), ca sa poata fi testate separat: node src/grafice.test.js

// Pastreaza cel mult `max` puncte (fiecare al k-lea + ultimul): pe 30 de zile la 2 s sunt ~1,3 mil. citiri,
// iar un grafic de ~1000 px latime nu poate arata mai mult de cateva sute oricum.
// shortcut: sare peste varfurile scurte dintre puncte; daca trebuie vazute, backend-ul sa trimita min/max pe intervale.
export function rareste(date, max = 800) {
  if (date.length <= max) return date
  const pas = Math.ceil(date.length / max)
  const rez = date.filter((_, i) => i % pas === 0)
  if (rez.at(-1) !== date.at(-1)) rez.push(date.at(-1))
  return rez
}

// [{timp, valori}] -> [{t: milisecunde, P: ..., U1N: ...}], forma ceruta de Recharts pentru axa de timp.
export function puncte(date, coduri) {
  return date.map((r) => {
    const p = { t: new Date(r.timp).getTime() }
    for (const c of coduri) p[c] = typeof r.valori[c] === 'number' ? r.valori[c] : null
    return p
  })
}

// Pe ora daca intervalul e de cel mult 2 zile, altfel pe zi.
export function pasConsum(date) {
  if (date.length < 2) return 'ora'
  const durata = new Date(date.at(-1).timp) - new Date(date[0].timp)
  return durata <= 2 * 86400000 ? 'ora' : 'zi'
}

// Consumul pe fiecare ora/zi = suma cresterilor contorului de energie Ea_tot_kWh intre citiri succesive.
// Fiecare crestere intra la ora/ziua citirii mai noi, deci nu se pierde nimic la trecerea dintre doua ore.
// Scaderile (contor resetat) si lipsurile se ignora.
export function consum(date, pas) {
  const lungime = pas === 'zi' ? 10 : 13 // "2026-11-12" sau "2026-11-12T10" din timpul ISO
  const rez = new Map()
  let anterior = null
  for (const r of date) {
    const e = r.valori.Ea_tot_kWh
    if (typeof e !== 'number') continue
    const cheie = r.timp.slice(0, lungime)
    if (!rez.has(cheie)) rez.set(cheie, 0)
    if (anterior !== null && e >= anterior) rez.set(cheie, rez.get(cheie) + (e - anterior))
    anterior = e
  }
  return [...rez].map(([cheie, kWh]) => ({ cheie, kWh }))
}

// Codurile alese -> [{unitate, coduri}]: un grafic pe unitate, ca V si A sa nu stea pe aceeasi axa.
export function grupeazaPeUnitati(coduri, obiecte) {
  const unitate = Object.fromEntries(obiecte.map((o) => [o.cod, o.unitate]))
  const grupe = new Map()
  for (const c of coduri) {
    const u = unitate[c] ?? ''
    if (!grupe.has(u)) grupe.set(u, [])
    grupe.get(u).push(c)
  }
  return [...grupe].map(([u, lista]) => ({ unitate: u, coduri: lista }))
}
