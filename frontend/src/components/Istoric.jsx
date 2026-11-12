import { useState } from 'react'

const PERIOADE = [
  ['azi', 'Azi'],
  ['7z', '7 zile'],
  ['30z', '30 zile'],
  ['custom', 'Aleg eu'],
]

export default function Istoric({ perioada, setPerioada, interval, aplicaInterval, incarcare, children }) {
  // Ciorna pentru "Aleg eu": se aplica abia la apasarea pe "Arată", nu la fiecare tasta.
  const [deLa, setDeLa] = useState(interval.deLa.slice(0, 16))
  const [panaLa, setPanaLa] = useState(interval.panaLa.slice(0, 16))

  return (
    <section aria-labelledby="t-ist" className="card sectiune">
      <div className="sectiune-cap">
        <h2 id="t-ist">Cum a evoluat</h2>
        <div className="segment" role="group" aria-label="Alege perioada">
          {PERIOADE.map(([id, text]) => (
            <button key={id} type="button" aria-pressed={perioada === id} onClick={() => setPerioada(id)}>{text}</button>
          ))}
        </div>
      </div>

      {perioada === 'custom' && (
        <form className="interval" onSubmit={(e) => { e.preventDefault(); aplicaInterval(deLa, panaLa) }}>
          <div className="camp">
            <label htmlFor="de-la">De la</label>
            <input id="de-la" type="datetime-local" value={deLa} onChange={(e) => setDeLa(e.target.value)} required />
          </div>
          <div className="camp">
            <label htmlFor="pana-la">Până la</label>
            <input id="pana-la" type="datetime-local" value={panaLa} min={deLa} onChange={(e) => setPanaLa(e.target.value)} required />
          </div>
          <button type="submit" className="buton-principal">Arată</button>
        </form>
      )}

      {incarcare && <p className="text-slab mic" role="status">Se încarcă istoricul…</p>}
      {children}
    </section>
  )
}
