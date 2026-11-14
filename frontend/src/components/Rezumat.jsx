import { format } from '../registre'

export default function Rezumat({ valori, conectat, consumPerioada }) {
  const kw = (w) => (typeof w === 'number' ? w / 1000 : null)
  const cifre = [
    { eticheta: 'Consumat în perioada aleasă', valoare: format(consumPerioada, 1), unitate: 'kWh' },
    { eticheta: 'Vârf de putere', valoare: format(kw(valori.P_cerere_max), 1), unitate: 'kW' },
    { eticheta: 'Factor de putere', valoare: format(valori.PF), unitate: '' },
    { eticheta: 'Sănătate întrerupător', valoare: format(valori['Durata_viata_%'], 0), unitate: '%' },
  ]
  return (
    <section className="card rezumat" aria-label="Rezumat">
      <div className="rezumat-text">
        <span className={conectat ? 'eticheta-ok' : 'eticheta-rau'}>
          {conectat ? 'Se citesc date' : 'Ultimele date cunoscute'}
        </span>
        <h1>Acum se consumă <span className="accent">{format(kw(valori.P), 2)} kW</span></h1>
        <p className="text-slab">
          {conectat
            ? 'Valoarea se actualizează singură la câteva secunde.'
            : 'Valorile nu se mai actualizează până când aparatul răspunde din nou.'}
        </p>
      </div>
      <div className="grila-2">
        {cifre.map((c) => (
          <div key={c.eticheta} className="cifra">
            <div className="text-slab mic">{c.eticheta}</div>
            <div className="valoare-mare">{c.valoare} <span className="unitate">{c.unitate}</span></div>
          </div>
        ))}
      </div>
    </section>
  )
}
