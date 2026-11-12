// Locul rezervat pentru graficul colegei.
// Primeste:
//   date     – [{timp, valori: {P: ..., U1N: ...}}] din /api/istoric, pentru intervalul ales
//   registre – codurile de afisat (ex. ['P', 'U1N']); in modul Simplu doar ['P']
// Graficul se pune in locul <div>-ului de mai jos.
export default function LocGrafic({ date, registre }) {
  return (
    <div className="loc-grafic">
      <strong>Grafic (componenta colegei)</strong>
      <span className="text-slab mic">
        {date.length} citiri · {registre.length ? registre.join(', ') : 'niciun registru ales'}
      </span>
    </div>
  )
}
