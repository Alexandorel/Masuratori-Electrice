import { format } from '../registre'

export default function Faze({ valori }) {
  const faze = [1, 2, 3].map((n) => ({ nume: `L${n}`, u: valori[`U${n}N`], i: valori[`IL${n}`] ?? 0 }))
  // Nu stim curentul nominal, asa ca bara arata incarcarea fata de cea mai incarcata faza.
  const maxim = Math.max(...faze.map((f) => f.i))
  const medie = faze.reduce((s, f) => s + f.i, 0) / 3

  return (
    <section aria-labelledby="t-faze" className="sectiune">
      <h2 id="t-faze">Cele 3 faze</h2>
      <div className="grila-auto">
        {faze.map((f) => {
          const dezechilibru = medie > 0 && f.i > medie * 1.2
          const procent = maxim > 0 ? Math.round((f.i / maxim) * 100) : 0
          return (
            <article key={f.nume} className="card faza">
              <div className="faza-cap">
                <h3>Faza {f.nume}</h3>
                <span className={dezechilibru ? 'eticheta-rau' : 'eticheta-ok'}>
                  {dezechilibru ? 'Mai încărcată' : 'Normal'}
                </span>
              </div>
              <div className="faza-valori">
                <div><div className="text-slab mic">Tensiune</div><div className="valoare-medie">{format(f.u, 1)} <span className="unitate">V</span></div></div>
                <div><div className="text-slab mic">Curent</div><div className="valoare-medie">{format(f.i, 1)} <span className="unitate">A</span></div></div>
              </div>
              <div className="bara" role="img" aria-label={`Încărcare ${procent}% față de faza cea mai încărcată`}>
                <div className={dezechilibru ? 'bara-plin bara-rau' : 'bara-plin'} style={{ width: `${procent}%` }} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
