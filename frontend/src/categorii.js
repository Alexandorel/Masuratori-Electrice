// categoriile din dropdown si din dashboard, dupa unitatea de masura
const GRUP_DUPA_UNITATE = {
  A: 'Curenți', V: 'Tensiuni', W: 'Puteri', var: 'Puteri', VA: 'Puteri', Hz: 'Frecvență',
  kWh: 'Energie', Wh: 'Energie', kVAh: 'Energie', VAh: 'Energie',
}
export const grup = (o) => (o.nume.startsWith('Nr_') ? 'Contoare declanșări' : GRUP_DUPA_UNITATE[o.unitate] ?? 'Stare și timp')
