import { useEffect, useState } from 'react'
import SelectorRegistre from './SelectorRegistre.jsx'
import { grup } from './categorii.js'
import GraficeIstoric from './GraficeIstoric.jsx'

const PRINCIPALE = ['IL1', 'IL2', 'IL3', 'U12', 'U23', 'U31', 'P', 'Q', 'S', 'PF', 'f']
const INTERVALE = { live: 'Live', 15: 'Ultimele 15 min', 60: 'Ultima oră', 1440: 'Ultimele 24 ore', custom: 'Personalizat' }

const fmt = (v) => (v == null ? '—' : typeof v === 'number' ? v.toFixed(3) : v)
const fmtTimp = (t) => (t == null ? '—' : new Date(t * 1000).toLocaleString('ro-RO'))
// <input type="datetime-local"> vrea "AAAA-LL-ZZTHH:MM" in ora locala
const inputLocal = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

async function cere(url) {
  const r = await fetch(url)
  const d = await r.json()
  if (!r.ok) throw new Error(d.eroare)
  return d
}

// preferintele raman salvate in browser; localStorage poate lipsi (fereastra privata)
function salvat(cheie, implicit) {
  try { return JSON.parse(localStorage.getItem(cheie)) ?? implicit } catch { return implicit }
}
function salveaza(cheie, valoare) {
  try { localStorage.setItem(cheie, JSON.stringify(valoare)) } catch { /* fara salvare */ }
}

const MAX_IMPLICIT_KW = 10
const nivel = (procent) => (procent < 50 ? 'verde' : procent < 80 ? 'portocaliu' : 'rosu')

function Consum({ dispozitive }) {
  const [maxime, setMaxime] = useState(() => salvat('maxime', {}))  // id dispozitiv -> kW
  useEffect(() => salveaza('maxime', maxime), [maxime])

  return (
    <section className="consum">
      <h2>Consum (putere activă)</h2>
      {dispozitive.map((d) => {
        const max = maxime[d.id] ?? MAX_IMPLICIT_KW
        const kw = d.eroare || d.P == null ? null : d.P / 1000
        const procent = Math.min(100, Math.max(0, (kw ?? 0) / max * 100))
        return (
          <div className="rand-consum" key={d.id}>
            <span>{d.id}</span>
            <div className="bara-consum" role="meter" aria-label={`Consum ${d.id}`}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(procent)}>
              <div className={nivel(procent)} style={{ width: `${procent}%` }} />
            </div>
            <span className="val">
              {kw == null ? 'fără date' : `${kw.toFixed(2)} kW (${Math.round(procent)}%)`} / max{' '}
              {/* necontrolat: lasa campul gol cat timp scrii, salvam doar valori > 0 */}
              <input type="number" min="0.1" step="any" defaultValue={max} aria-label={`Consum maxim ${d.id} (kW)`}
                onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) setMaxime({ ...maxime, [d.id]: v }) }} />
              {' '}kW
            </span>
          </div>
        )
      })}
    </section>
  )
}

export default function App() {
  const [obiecte, setObiecte] = useState([])
  const [dispozitive, setDispozitive] = useState([])
  const [dispozitiv, setDispozitiv] = useState('')
  const [selectate, setSelectate] = useState(() => salvat('registre', PRINCIPALE))
  const [vedere, setVedere] = useState(() => salvat('vedere', 'grafice'))
  const [sigma, setSigma] = useState(() => salvat('sigma', 0))
  const [interval, setInterval_] = useState('live')
  const [de, setDe] = useState(() => inputLocal(new Date(Date.now() - 3600_000)))
  const [pana, setPana] = useState(() => inputLocal(new Date()))
  const [live, setLive] = useState(null)
  const [istoric, setIstoric] = useState(null)
  const [eroare, setEroare] = useState(null)

  useEffect(() => salveaza('registre', selectate), [selectate])
  useEffect(() => salveaza('vedere', vedere), [vedere])
  useEffect(() => salveaza('sigma', sigma), [sigma])

  // lista registrelor + starea dispozitivelor (la 2 s)
  useEffect(() => {
    cere('/api/obiecte').then(setObiecte).catch(() => {})
    const actualizeaza = () =>
      cere('/api/dispozitive')
        .then((d) => { setDispozitive(d); setDispozitiv((x) => x || d[0]?.id || ''); setEroare(null) })
        .catch(() => setEroare('Serverul nu răspunde. Rulează: python server.py --demo'))
    actualizeaza()
    const id = setInterval(actualizeaza, 2000)
    return () => clearInterval(id)
  }, [])

  // mod Live: ultima citire la 2 s
  useEffect(() => {
    if (interval !== 'live' || !dispozitiv) return
    const citeste = () => cere(`/api/date?dispozitiv=${encodeURIComponent(dispozitiv)}`).then(setLive).catch(() => {})
    citeste()
    const id = setInterval(citeste, 2000)
    return () => clearInterval(id)
  }, [interval, dispozitiv])

  // mod istoric: intervalele relative se reincarca la 10 s, cel personalizat o singura data
  // coloanele tabelului, ordonate pe categorii ca fiecare categorie sa fie un bloc continuu
  const grupeTabel = Object.entries(Object.groupBy(obiecte.filter((o) => o.numeric && selectate.includes(o.nume)), grup))
  const numerice = grupeTabel.flatMap(([, lista]) => lista)
  const registre = numerice.map((o) => o.nume).join(',')
  useEffect(() => {
    if (interval === 'live' || !dispozitiv || !registre) { setIstoric(null); return }
    const incarca = () => {
      const [start, sfarsit] = interval === 'custom'
        ? [new Date(de), new Date(pana)]
        : [new Date(Date.now() - interval * 60000), new Date()]
      const q = new URLSearchParams({ dispozitiv, registre, de: start / 1000, pana: sfarsit / 1000 })
      cere(`/api/istoric?${q}`).then(setIstoric).catch((e) => setEroare(e.message))
    }
    incarca()
    if (interval === 'custom') return
    const id = setInterval(incarca, 10000)
    return () => clearInterval(id)
  }, [interval, dispozitiv, registre, de, pana])

  const stare = dispozitive.find((d) => d.id === dispozitiv)
  const grupeLive = Object.entries(Object.groupBy(obiecte.filter((o) => selectate.includes(o.nume)), grup))

  return (
    <main>
      <h1>Contor Eaton PXR</h1>
      <Consum dispozitive={dispozitive} />

      <div className="bara">
        <label>Dispozitiv
          <select value={dispozitiv} onChange={(e) => setDispozitiv(e.target.value)}>
            {dispozitive.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
          </select>
        </label>
        <SelectorRegistre obiecte={obiecte} selectate={selectate} setSelectate={setSelectate} />
        <label>Interval
          <select value={interval} onChange={(e) => setInterval_(e.target.value)}>
            {Object.entries(INTERVALE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {interval === 'custom' && <>
          <label>De la <input type="datetime-local" value={de} onChange={(e) => setDe(e.target.value)} /></label>
          <label>Până la <input type="datetime-local" value={pana} onChange={(e) => setPana(e.target.value)} /></label>
        </>}
      </div>

      {stare && (
        <p className={stare.eroare ? 'stare rau' : 'stare bine'}>
          {stare.eroare ?? 'Conectat'} · ultima citire: {fmtTimp(stare.timp)}
        </p>
      )}
      {eroare && <p className="stare rau">{eroare}</p>}
      {selectate.length === 0 && <p>Alege registrele din lista „Registre”.</p>}

      {interval === 'live' ? (
        grupeLive.map(([categorie, lista]) => (
          <section key={categorie}>
            <h2>{categorie}</h2>
            <div className="carduri">
              {lista.map((o) => (
                <div className="card" key={o.nume}>
                  <small>{o.descriere}</small>
                  <b>{fmt(live?.valori[o.nume])}</b>
                  <small>{o.nume} [{o.unitate}]</small>
                </div>
              ))}
            </div>
          </section>
        ))
      ) : istoric && (
        <>
          <div className="sub-bara">
            <div className="comutator" role="group" aria-label="Mod de afișare">
              {['grafice', 'tabel'].map((v) => (
                <button key={v} type="button" aria-pressed={vedere === v} onClick={() => setVedere(v)}>
                  {v === 'grafice' ? 'Grafice' : 'Tabel'}
                </button>
              ))}
            </div>
            {vedere === 'grafice' && (
              <label className="sigma">Netezire Gauss σ
                <input type="range" min={0} max={20} step={1} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} />
                <output>{sigma === 0 ? 'oprită' : `${sigma} puncte`}</output>
              </label>
            )}
            <span className="nota">
              {istoric.randuri.length} puncte{istoric.pas > 1 && ` · fiecare punct = media pe ${istoric.pas} s`}
            </span>
          </div>
          {istoric.randuri.length === 0 ? <p>Nicio citire în acest interval.</p>
            : vedere === 'grafice' ? (
            // key: la alt dispozitiv sau alt interval, graficele se creeaza din nou, deci zoom-ul se reseteaza
            <GraficeIstoric key={`${dispozitiv}|${interval}|${de}|${pana}`}
              randuri={istoric.randuri} grupe={grupeTabel} sigma={sigma} />
          ) : (
          <div className="tabel">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>Timp</th>
                  {grupeTabel.map(([categorie, lista]) => <th key={categorie} colSpan={lista.length} className="categorie">{categorie}</th>)}
                </tr>
                <tr>{numerice.map((o) => <th key={o.nume} title={o.descriere}>{o.nume} [{o.unitate}]</th>)}</tr>
              </thead>
              <tbody>
                {istoric.randuri.map((r) => (
                  <tr key={r.timp}>
                    <td>{fmtTimp(r.timp)}</td>
                    {numerice.map((o) => <td key={o.nume} className="val">{fmt(r[o.nume])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}
    </main>
  )
}
