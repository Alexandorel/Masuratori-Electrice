import { useState } from 'react'
import { format } from '../registre'

const PE_GRAFIC = 'Pe grafic'

export default function Registre({ registre, valori, peGrafic, comuta }) {
  const [fila, setFila] = useState(PE_GRAFIC)
  const [cautare, setCautare] = useState('')

  const grupe = [...new Set(registre.map((r) => r.grupa))]
  const q = cautare.trim().toLowerCase()
  // Cautarea are prioritate fata de fila aleasa si cauta in toate grupele.
  const vizibile = q
    ? registre.filter((r) => r.nume.toLowerCase().includes(q) || r.cod.toLowerCase().includes(q))
    : registre.filter((r) => (fila === PE_GRAFIC ? peGrafic.includes(r.cod) : r.grupa === fila))

  return (
    <section aria-labelledby="t-reg" className="card sectiune">
      <div className="sectiune-cap">
        <div>
          <h2 id="t-reg">Registre</h2>
          <p className="text-slab">Bifează „Pe grafic” la mărimile pe care vrei să le vezi în grafic.</p>
        </div>
        <div className="camp">
          <label htmlFor="cauta" className="text-slab mic">Caută o mărime</label>
          <input id="cauta" type="search" value={cautare} onChange={(e) => setCautare(e.target.value)} placeholder="ex. tensiune, IL1" />
        </div>
      </div>

      <div className="file" role="tablist" aria-label="Categorii de registre">
        {[PE_GRAFIC, ...grupe].map((g) => (
          <button key={g} type="button" role="tab" aria-selected={!q && fila === g}
            onClick={() => { setFila(g); setCautare('') }}>
            {g === PE_GRAFIC ? `${PE_GRAFIC} (${peGrafic.length})` : g}
          </button>
        ))}
      </div>

      {vizibile.length === 0 && (
        <div className="gol">
          {q ? `Nicio mărime nu se potrivește cu „${cautare}”.` : 'Nimic pe grafic încă. Deschide o categorie și bifează „Pe grafic”.'}
        </div>
      )}

      <div className="grila-registre" role="tabpanel">
        {vizibile.map((r) => {
          const bifat = peGrafic.includes(r.cod)
          return (
            <div key={r.cod} className={bifat ? 'registru bifat' : 'registru'}>
              <span className="registru-nume">{r.nume}</span>
              <div className="valoare-medie">{format(valori[r.cod])} <span className="unitate">{r.unitate}</span></div>
              <div className="registru-jos">
                <span className="cod">{r.cod}</span>
                <label className="bifa">
                  <input type="checkbox" checked={bifat} onChange={() => comuta(r.cod)} />
                  Pe grafic
                </label>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
