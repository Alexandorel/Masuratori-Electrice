import { useEffect, useRef, useState } from 'react'
import { grup } from './categorii.js'

export default function SelectorRegistre({ obiecte, selectate, setSelectate }) {
  const [cautare, setCautare] = useState('')
  const ref = useRef(null)

  // inchide lista la click in afara ei
  useEffect(() => {
    const laClick = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false }
    document.addEventListener('click', laClick)
    return () => document.removeEventListener('click', laClick)
  }, [])

  const text = cautare.toLowerCase()
  const vizibile = obiecte.filter((o) => (o.nume + ' ' + o.descriere).toLowerCase().includes(text))
  const grupuri = Object.groupBy(vizibile, grup)

  const comuta = (nume) =>
    setSelectate(selectate.includes(nume) ? selectate.filter((n) => n !== nume) : [...selectate, nume])

  return (
    <details className="dropdown" ref={ref}>
      <summary>Registre ({selectate.length})</summary>
      <div className="panou">
        <input type="search" placeholder="Caută (ex. IL1, tensiune)…" value={cautare}
          onChange={(e) => setCautare(e.target.value)} autoFocus />
        <button type="button" onClick={() => setSelectate([])}>Golește selecția</button>
        {Object.entries(grupuri).map(([nume, lista]) => (
          <fieldset key={nume}>
            <legend>{nume}</legend>
            {lista.map((o) => (
              <label key={o.nume}>
                <input type="checkbox" checked={selectate.includes(o.nume)} onChange={() => comuta(o.nume)} />
                {o.descriere} <small>{o.nume}</small>
              </label>
            ))}
          </fieldset>
        ))}
        {vizibile.length === 0 && <p>Niciun registru găsit.</p>}
      </div>
    </details>
  )
}
