import { useEffect, useState } from 'react'
import * as api from './api'
import { APARATE } from './aparate'
import { grupeaza } from './registre'
import Antet from './components/Antet'
import AlegeAparat from './components/AlegeAparat'
import Rezumat from './components/Rezumat'
import Faze from './components/Faze'
import Registre from './components/Registre'
import Istoric from './components/Istoric'
import LocGrafic from './components/LocGrafic'
import './App.css'

const INTERVAL_CITIRE_MS = 2000
// Daca ultima citire e mai veche de atat, consideram ca aparatul nu mai raspunde.
const VECHIME_MAXIMA_MS = 10000

// Data -> "YYYY-MM-DDTHH:MM:SS" in ora locala, formatul din CSV-ul backend-ului.
function oraLocala(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
}

function calculeazaInterval(perioada) {
  const acum = new Date()
  const start = new Date(acum)
  if (perioada === 'azi') start.setHours(0, 0, 0, 0)
  if (perioada === '7z') start.setDate(start.getDate() - 7)
  if (perioada === '30z') start.setDate(start.getDate() - 30)
  return { deLa: oraLocala(start), panaLa: oraLocala(acum) }
}

export default function App() {
  const [mod, setMod] = useState('simplu')
  const [adresa, setAdresa] = useState(APARATE[0].adresa)
  const [registre, setRegistre] = useState([])
  const [citire, setCitire] = useState(null)
  const [eroare, setEroare] = useState(false)
  const [perioada, setPerioada] = useState('azi')
  const [interval, setIntervalTimp] = useState(() => calculeazaInterval('azi'))
  const [istoric, setIstoric] = useState([])
  const [incarcare, setIncarcare] = useState(false)
  const [peGrafic, setPeGrafic] = useState(['P'])

  // Lista de registre se cere o singura data, la pornire.
  useEffect(() => {
    api.obiecte().then((o) => setRegistre(grupeaza(o))).catch(() => setEroare(true))
  }, [])

  // Ultima citire, ceruta periodic; intervalul se opreste cand componenta dispare.
  useEffect(() => {
    const citeste = () =>
      api.curent()
        .then((c) => { setCitire(c); setEroare(false) })
        .catch(() => setEroare(true))
    citeste()
    const id = setInterval(citeste, INTERVAL_CITIRE_MS)
    return () => clearInterval(id)
  }, [adresa])

  // Istoricul se cere din nou de fiecare data cand se schimba intervalul.
  useEffect(() => {
    let anulat = false
    setIncarcare(true)
    api.istoric(interval.deLa, interval.panaLa)
      .then((r) => { if (!anulat) setIstoric(r) })
      .catch(() => { if (!anulat) setIstoric([]) })
      .finally(() => { if (!anulat) setIncarcare(false) })
    // Daca utilizatorul schimba intervalul inainte sa vina raspunsul, ignoram raspunsul vechi.
    return () => { anulat = true }
  }, [interval])

  function alegePerioada(p) {
    setPerioada(p)
    if (p !== 'custom') setIntervalTimp(calculeazaInterval(p))
  }

  function comuta(cod) {
    setPeGrafic((lista) => (lista.includes(cod) ? lista.filter((c) => c !== cod) : [...lista, cod]))
  }

  const valori = citire?.valori ?? {}
  const vechime = citire ? Date.now() - new Date(citire.timp).getTime() : Infinity
  const conectat = !eroare && vechime < VECHIME_MAXIMA_MS
  const ora = citire ? citire.timp.slice(11, 19) : null
  const stareText = eroare ? 'Serverul nu răspunde'
    : !citire ? 'Se așteaptă prima citire'
    : conectat ? 'Conectat' : `Nu răspunde de la ${ora}`

  // Consumul in interval = diferenta contorului de energie intre prima si ultima citire.
  const energii = istoric.map((r) => r.valori.Ea_tot_kWh).filter((v) => typeof v === 'number')
  const consumPerioada = energii.length > 1 ? energii[energii.length - 1] - energii[0] : null

  return (
    <div className="aplicatie">
      <Antet stare={ora ? `${stareText} · ultima citire ${ora}` : stareText} mod={mod} setMod={setMod} />
      <main className="pagina continut">
        <AlegeAparat aparate={APARATE} adresa={adresa} setAdresa={setAdresa} conectat={conectat} stareText={stareText} />

        {!conectat && citire && (
          <div className="avertisment" role="status">
            <strong>Aparatul nu mai răspunde de la {ora}.</strong> Vezi ultimele valori citite.
            Verifică dacă e pornit și dacă firul de comunicație e conectat.
          </div>
        )}

        <Rezumat valori={valori} conectat={conectat} consumPerioada={consumPerioada} />
        <Faze valori={valori} />
        {mod === 'detaliat' && (
          <Registre registre={registre} valori={valori} peGrafic={peGrafic} comuta={comuta} />
        )}
        <Istoric perioada={perioada} setPerioada={alegePerioada} interval={interval}
          aplicaInterval={(deLa, panaLa) => setIntervalTimp({ deLa: deLa + ':00', panaLa: panaLa + ':59' })}
          incarcare={incarcare}>
          <LocGrafic date={istoric} registre={mod === 'simplu' ? ['P'] : peGrafic} obiecte={registre} />
        </Istoric>
      </main>
    </div>
  )
}
