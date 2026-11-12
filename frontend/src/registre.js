// Grupele din sectiunea "Registre" si nume pe intelesul tuturor.
// Codurile sunt cele din /api/obiecte; ce nu e listat aici ajunge in grupa "Altele"
// cu descrierea venita de la backend.
export const GRUPE = [
  ['Puteri', { P: 'Putere activă', Q: 'Putere reactivă', S: 'Putere aparentă', PF: 'Factor de putere' }],
  ['Tensiuni', {
    U1N: 'Tensiune L1–N', U2N: 'Tensiune L2–N', U3N: 'Tensiune L3–N',
    U12: 'Tensiune L1–L2', U23: 'Tensiune L2–L3', U31: 'Tensiune L3–L1',
  }],
  ['Curenți', { IL1: 'Curent L1', IL2: 'Curent L2', IL3: 'Curent L3', IN: 'Curent neutru', IG: 'Curent de defect' }],
  ['Energie', {
    Ea_dir_kWh: 'Energie activă directă', Ea_inv_kWh: 'Energie activă inversă',
    Ea_tot_kWh: 'Energie activă totală', Es_kVAh: 'Energie aparentă',
  }],
  ['Rețea și cerere', {
    f: 'Frecvență', P_cerere: 'Cerere putere activă', P_cerere_max: 'Vârf cerere putere activă',
    Q_cerere: 'Cerere putere reactivă', S_cerere: 'Cerere putere aparentă',
  }],
  ['Întrerupător', {
    Nr_decl_total: 'Declanșări (total)', Nr_manevre: 'Manevre',
    Timp_func_h: 'Ore de funcționare', 'Durata_viata_%': 'Durată de viață rămasă',
  }],
]

// Lista de la backend -> [{grupa, cod, nume, unitate}], in ordinea grupelor de mai sus.
export function grupeaza(obiecte) {
  const rez = obiecte.map((o) => {
    const g = GRUPE.find(([, nume]) => o.nume in nume)
    return {
      grupa: g ? g[0] : 'Altele',
      cod: o.nume,
      nume: g ? g[1][o.nume] : o.descriere,
      unitate: o.unitate === '-' ? '' : o.unitate,
    }
  })
  const ordine = [...GRUPE.map(([g]) => g), 'Altele']
  return rez.sort((a, b) => ordine.indexOf(a.grupa) - ordine.indexOf(b.grupa))
}

// Afisare romaneasca: 4812 -> "4.812", 0.96 -> "0,96"; lipsa -> "—"
export function format(v, zecimale = 2) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v !== 'number') return String(v)
  return v.toLocaleString('ro-RO', { maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : zecimale })
}
