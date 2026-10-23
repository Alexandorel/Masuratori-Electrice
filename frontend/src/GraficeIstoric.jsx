import { useMemo, useState } from 'react'
import {
  Brush, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { netezeste } from './gauss.js'

const CULORI = ['#2f6fd6', '#d9622b', '#2a9d4b', '#b8418f', '#c99a06', '#16a3b0', '#7a5bd1', '#8a6d3b']
const ZI = 86400
const NETEZIT = '_netezit'  // sufixul cheii cu valorile netezite: IL1 -> IL1_netezit

// un grafic pentru fiecare (categorie, unitate): pe o axa Y stau doar marimi masurate in aceeasi unitate
export default function GraficeIstoric({ randuri, grupe, sigma }) {
  // adaugam in fiecare rand si valorile netezite; recalculam doar cand se schimba datele, registrele sau sigma
  // (`grupe` e un obiect nou la fiecare randare a paginii, deci comparam lista de nume ca text)
  const chei = grupe.flatMap(([, lista]) => lista.map((o) => o.nume)).join(',')
  const date = useMemo(() => {
    if (!(sigma > 0)) return randuri
    const nume = chei.split(',')
    const netezite = Object.fromEntries(nume.map((n) => [n, netezeste(randuri.map((r) => r[n]), sigma)]))
    return randuri.map((r, i) => ({ ...r, ...Object.fromEntries(nume.map((n) => [n + NETEZIT, netezite[n][i]])) }))
  }, [randuri, chei, sigma])

  const durata = randuri.length ? randuri.at(-1).timp - randuri[0].timp : 0
  const ceas = (t) => new Date(t * 1000).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  const axaX = (t) => (durata > ZI ? `${new Date(t * 1000).toLocaleDateString('ro-RO')} ${ceas(t)}` : ceas(t))

  const grafice = grupe.flatMap(([categorie, lista]) =>
    Object.entries(Object.groupBy(lista, (o) => o.unitate)).map(([unitate, registre]) => ({ categorie, unitate, registre })))

  return grafice.map(({ categorie, unitate, registre }) => (
    <Grafic key={categorie + unitate} titlu={categorie} unitate={unitate} registre={registre}
      date={date} netezit={sigma > 0} axaX={axaX} />
  ))
}

function Grafic({ titlu, unitate, registre, date, netezit, axaX }) {
  const [ascunse, setAscunse] = useState([])
  // zoom-ul se tine ca interval de timp, nu ca indici: la reincarcarea datelor (la 10 s) ramane pe aceeasi perioada
  const [zoom, setZoom] = useState(null)       // [t1, t2] sau null = tot intervalul
  const [selectie, setSelectie] = useState(null)  // [t1, t2] cat timp tragi cu mouse-ul

  const comuta = (nume) => setAscunse(ascunse.includes(nume) ? ascunse.filter((n) => n !== nume) : [...ascunse, nume])

  // indicii punctelor din zoom, pentru bara Brush
  let start = 0
  let sfarsit = date.length - 1
  if (zoom) {
    start = Math.max(0, date.findIndex((r) => r.timp >= zoom[0]))
    sfarsit = date.findLastIndex((r) => r.timp <= zoom[1])
    if (sfarsit <= start) [start, sfarsit] = [0, date.length - 1]  // perioada a iesit din date
  }

  const terminaSelectia = () => {
    if (selectie && selectie[0] !== selectie[1]) setZoom([Math.min(...selectie), Math.max(...selectie)])
    setSelectie(null)
  }

  return (
    <section className="grafic">
      <div className="titlu-grafic">
        <h2>{titlu} <small>[{unitate}]</small></h2>
        {zoom && <button type="button" onClick={() => setZoom(null)}>Resetează zoom</button>}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={date} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
          // e.activeLabel = timpul punctului de sub mouse; e e null in afara zonei graficului (ex. pe bara Brush)
          onMouseDown={(e) => e?.activeLabel != null && setSelectie([e.activeLabel, e.activeLabel])}
          onMouseMove={(e) => selectie && e?.activeLabel != null && setSelectie([selectie[0], e.activeLabel])}
          onMouseUp={terminaSelectia} onMouseLeave={terminaSelectia}>
          <CartesianGrid strokeDasharray="3 3" stroke="#8884" />
          <XAxis dataKey="timp" type="number" scale="time" domain={['dataMin', 'dataMax']}
            tickFormatter={axaX} minTickGap={40} stroke="currentColor" fontSize={12} />
          <YAxis width={70} stroke="currentColor" fontSize={12} domain={['auto', 'auto']} />
          <Tooltip labelFormatter={(t) => new Date(t * 1000).toLocaleString('ro-RO')}
            formatter={(v) => (v == null ? '—' : v.toFixed(3))}
            contentStyle={{ background: 'Canvas', border: '1px solid #8884' }} />
          <Legend onClick={(e) => comuta(e.dataKey.replace(NETEZIT, ''))} wrapperStyle={{ cursor: 'pointer' }} />
          {registre.flatMap((o, i) => {
            const culoare = CULORI[i % CULORI.length]
            const ascuns = ascunse.includes(o.nume)
            // fara animatie: graficul se reincarca la 10 s si ar "sari" de fiecare data
            const brut = (
              <Line key={o.nume} dataKey={o.nume} stroke={culoare} dot={false} isAnimationActive={false} hide={ascuns}
                {...(netezit
                  ? { name: `${o.nume} (original)`, strokeWidth: 1, strokeOpacity: 0.3, legendType: 'none' }
                  : { name: o.nume, strokeWidth: 2 })} />
            )
            return netezit ? [brut,
              <Line key={o.nume + NETEZIT} dataKey={o.nume + NETEZIT} name={o.nume} stroke={culoare} dot={false}
                strokeWidth={2.5} isAnimationActive={false} hide={ascuns} />,
            ] : [brut]
          })}
          {selectie && <ReferenceArea x1={selectie[0]} x2={selectie[1]} fill="#2f6fd6" fillOpacity={0.15} />}
          <Brush dataKey="timp" height={28} stroke="#2f6fd6" fill="transparent" tickFormatter={axaX}
            startIndex={start} endIndex={sfarsit}
            onChange={(r) => setZoom(r.startIndex === 0 && r.endIndex === date.length - 1
              ? null : [date[r.startIndex].timp, date[r.endIndex].timp])} />
        </LineChart>
      </ResponsiveContainer>
    </section>
  )
}
